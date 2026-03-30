from dataclasses import dataclass, field
from typing import List, Dict, Optional
import json
import os

@dataclass
class MixAction:
    action_type: str # "EQ_CUT", "EQ_BOOST", "FADER", "COMPRESSION"
    target: str      # "LOW_MID", "250Hz", "MAIN_FADER"
    value: float     # -3.0 (dB), 0.8 (Ratio), etc.
    reason: str      # "Muddiness detected", "Low SPL", "Feedback Risk", "Matches Profile"
    confidence: float # 0.0 to 1.0

@dataclass
class TargetProfile:
    name: str
    target_energies: Dict[str, float]

class RecommendationEngine:
    def __init__(self):
        # Thresholds
        self.mud_threshold = 0.4
        self.harsh_threshold = 0.4
        self.ideal_spl_min = -25.0
        self.ideal_spl_max = -6.0
        
        # Profile State
        self.active_profile: Optional[TargetProfile] = None
        self.match_threshold = 0.15 # 15% deviation triggers correction

    def load_profile(self, filepath: str):
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
                self.active_profile = TargetProfile(
                    name=data["name"],
                    target_energies=data["target_energies"]
                )
                print(f"Loaded Profile: {self.active_profile.name}")
        except Exception as e:
            print(f"Failed to load profile: {e}")

    def analyze(self, features: Dict) -> List[MixAction]:
        actions = []
        
        # 1. Base Logic (Universal Issues)
        # Even with a profile, "Muddiness" is usually bad.
        # However, if the profile DEMANDS low-mid (like a tom), we might skip this.
        # For now, we'll keep safety checks as primary.
        base_actions = self._analyze_safety(features)
        actions.extend(base_actions)
        
        # 2. Profile Matching (if active)
        if self.active_profile:
            match_actions = self._analyze_profile_match(features)
            actions.extend(match_actions)
            
        return actions

    def _analyze_safety(self, features) -> List[MixAction]:
        actions = []
        issues = features.get("issues", {})
        spl_db = features.get("spl_db", -100.0)
        
        # Muddiness
        mud_severity = issues.get("muddiness", 0.0)
        if mud_severity > self.mud_threshold:
            cut_db = -1.0 - (mud_severity * 4.0)
            actions.append(MixAction("EQ_CUT", "300Hz", round(cut_db, 1), f"Muddiness (Sev: {mud_severity:.2f})", 0.85))
            
        # Harshness
        harsh_severity = issues.get("harshness", 0.0)
        if harsh_severity > self.harsh_threshold:
            cut_db = -1.0 - (harsh_severity * 4.0)
            actions.append(MixAction("EQ_CUT", "3kHz", round(cut_db, 1), f"Harshness (Sev: {harsh_severity:.2f})", 0.85))
            
        # SPL
        if spl_db > self.ideal_spl_max:
             actions.append(MixAction("FADER", "MASTER", -2.0, "Levels peaking", 0.95))
        
        return actions

    def _analyze_profile_match(self, features) -> List[MixAction]:
        actions = []
        live_energies = features.get("band_energies", {})
        target_energies = self.active_profile.target_energies
        
        # Compare band by band
        for band, target_val in target_energies.items():
            live_val = live_energies.get(band, 0.0)
            
            # Simple Delta
            delta = live_val - target_val
            
            # Threshold Check
            if abs(delta) > self.match_threshold:
                # Need Correction
                # Map Delta (0.1 - 0.5) to dB (-1 to -6)
                # Gain Factor ~ 10x
                correction_db = delta * 10 
                
                # Clamp
                correction_db = max(min(correction_db, 6.0), -6.0)
                
                if correction_db > 1.0: # Live is louder -> CUT
                    actions.append(MixAction(
                        "EQ_CUT", 
                        f"{band.upper()}", 
                        round(-correction_db, 1), 
                        f"Match '{self.active_profile.name}' (Excess: {delta:.2f})", 
                        0.7
                    ))
                elif correction_db < -1.0: # Live is quieter -> BOOST
                    actions.append(MixAction(
                        "EQ_BOOST", 
                        f"{band.upper()}", 
                        round(abs(correction_db), 1), 
                        f"Match '{self.active_profile.name}' (Lacking: {abs(delta):.2f})", 
                        0.7
                    ))
                    
        return actions

if __name__ == "__main__":
    eng = RecommendationEngine()
    # Test Loading
    eng.active_profile = TargetProfile("Test Kick", {"low": 0.8, "mid": 0.2})
    feats = {"band_energies": {"low": 0.95, "mid": 0.2}, "issues": {}}
    print(eng.analyze(feats))
