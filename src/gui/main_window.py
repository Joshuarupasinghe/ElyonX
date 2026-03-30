import sys
import numpy as np
import pyqtgraph as pg
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QFrame, QGridLayout)
from PyQt6.QtCore import QTimer, Qt
from PyQt6.QtGui import QFont, QColor

from src.audio.stream import AudioInputStream
from src.features.analyzer import AudioFeatureExtractor
from src.intelligence.ml_engine import MLRecommendationEngine

class ElyonXMainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ElyonX - Intelligent Mixing System")
        self.resize(1200, 800)
        self.setStyleSheet("background-color: #121212; color: #E0E0E0;")
        
        # Initialize Subsystems
        self.audio_stream = AudioInputStream()
        self.extractor = AudioFeatureExtractor()
        # Use ML-based engine (model can be provided at models/kick_eq_comp_gate.pth)
        self.engine = MLRecommendationEngine(model_path=None)
        
        # Audio Buffer for Visualization
        self.viz_buffer_size = 2048 # Number of samples to show in Waveform
        
        self.setup_ui()
        
        # Start Audio
        try:
            self.audio_stream.start()
        except Exception as e:
            print(f"Audio Error: {e}")
            
        # Timer for GUI Update (30 FPS)
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_loop)
        self.timer.start(33) 

    def setup_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        
        # Header
        header = QLabel("ELYON X - FOH ASSISTANT")
        header.setFont(QFont("Arial", 20, QFont.Weight.Bold))
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header.setStyleSheet("color: #00ADB5; padding: 10px;")
        main_layout.addWidget(header)
        
        # Top Section: RTA & Waveform
        viz_layout = QHBoxLayout()
        
        # RTA Plot
        self.rta_plot = pg.PlotWidget(title="Real-Time Spectrum (RTA)")
        self.rta_plot.setLogMode(x=True, y=False)
        self.rta_plot.setYRange(0, 0.1) # Normalized mag
        self.rta_plot.setXRange(np.log10(20), np.log10(20000))
        self.rta_curve = self.rta_plot.plot(pen=pg.mkPen('#00ADB5', width=2))
        self.rta_plot.setBackground('#1E1E1E')
        self.rta_plot.showGrid(x=True, y=True, alpha=0.3)
        viz_layout.addWidget(self.rta_plot, stretch=2)
        
        # Waveform Plot (small)
        self.wave_plot = pg.PlotWidget(title="Waveform")
        self.wave_plot.setYRange(-1, 1)
        self.wave_curve = self.wave_plot.plot(pen=pg.mkPen('#EEEEEE', width=1))
        self.wave_plot.setBackground('#1E1E1E')
        viz_layout.addWidget(self.wave_plot, stretch=1)
        
        main_layout.addLayout(viz_layout, stretch=3)
        
        # Middle Section: Indicators
        indicator_layout = QHBoxLayout()
        self.spl_label = self.create_indicator("SPL: -- dB")
        self.mud_label = self.create_indicator("Mud: --")
        self.harsh_label = self.create_indicator("Harsh: --")
        indicator_layout.addWidget(self.spl_label)
        indicator_layout.addWidget(self.mud_label)
        indicator_layout.addWidget(self.harsh_label)
        main_layout.addLayout(indicator_layout, stretch=1)
        
        # Bottom Section: Recommendations (Card Flow)
        rec_label = QLabel("RECOMMENDATIONS")
        rec_label.setFont(QFont("Arial", 14, QFont.Weight.Bold))
        main_layout.addWidget(rec_label)
        
        self.rec_layout = QGridLayout()
        # Create fixed slots for recommendations
        self.rec_slots = []
        for i in range(4): # Max 4 cards
            frame = QFrame()
            frame.setStyleSheet("background-color: #222831; border-radius: 8px; border: 1px solid #393E46;")
            frame.setFrameShape(QFrame.Shape.StyledPanel)
            layout = QVBoxLayout(frame)
            
            lbl_title = QLabel("NO ACTION")
            lbl_title.setStyleSheet("font-weight: bold; color: #AAAAAA;")
            
            lbl_detail = QLabel("System monitoring...")
            lbl_detail.setWordWrap(True)
            
            layout.addWidget(lbl_title)
            layout.addWidget(lbl_detail)
            
            self.rec_slots.append((lbl_title, lbl_detail, frame))
            self.rec_layout.addWidget(frame, 0, i)
            
        main_layout.addLayout(self.rec_layout, stretch=2)

    def create_indicator(self, text):
        lbl = QLabel(text)
        lbl.setStyleSheet("background-color: #222831; padding: 10px; border-radius: 5px; font-size: 16px;")
        lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        return lbl

    def update_loop(self):
        # 1. Get Audio Data
        try:
            # Read enough for FFT
            raw_samples = self.audio_stream.read(self.extractor.sample_rate // 10) # 100ms
            
            # Update Waveform (Visualize snippet)
            if len(raw_samples) > 2048:
                self.wave_curve.setData(raw_samples[-2048:])
            
            # 2. Extract Features
            features = self.extractor.process_block(raw_samples)
            
            # 3. Update Visuals
            freqs = features["spectrum_freqs"]
            mags = features["spectrum_mag"]
            
            # Avoid log(0) error for plotting if needed, but pyqtgraph logmode handles x>0
            # Filter freqs > 20Hz
            mask = freqs > 20
            self.rta_curve.setData(freqs[mask], mags[mask])
            
            # Indicators
            spl = features["spl_db"]
            issues = features["issues"]
            
            self.spl_label.setText(f"SPL: {spl:.1f} dB")
            
            mud = issues.get("muddiness", 0)
            self.mud_label.setText(f"Mud: {mud:.2f}")
            if mud > 0.4: self.mud_label.setStyleSheet("background-color: #D32F2F; color: white; padding: 10px;")
            else: self.mud_label.setStyleSheet("background-color: #222831; color: white; padding: 10px;")
            
            harsh = issues.get("harshness", 0)
            self.harsh_label.setText(f"Harsh: {harsh:.2f}")
            if harsh > 0.4: self.harsh_label.setStyleSheet("background-color: #D32F2F; color: white; padding: 10px;")
            else: self.harsh_label.setStyleSheet("background-color: #222831; color: white; padding: 10px;")

            # 4. Get Recommendations
            actions = self.engine.analyze(features)
            self.update_recommendations(actions)
            
        except Exception as e:
            # print(e) # Spam prevention
            pass

    def update_recommendations(self, actions):
        # Clear/Reset slots if fewer actions
        for i, (lbl_t, lbl_d, frame) in enumerate(self.rec_slots):
            if i < len(actions):
                action = actions[i]
                # Support both legacy MixAction and new MLAction structures
                atype = getattr(action, 'action_type', 'ACTION')
                params = getattr(action, 'params', None)

                # Determine border color
                if atype in ("EQ_CUT", "EQ_BOOST"):
                    border_col = "#FF5722"
                elif atype == "FADER":
                    border_col = "#2196F3"
                elif atype in ("COMPRESSION", "GATE"):
                    border_col = "#9C27B0"
                else:
                    border_col = "#4CAF50"

                frame.setStyleSheet(f"background-color: #222831; border-radius: 8px; border: 2px solid {border_col};")

                # Compose title and detail based on available fields
                if params is not None:
                    # MLAction
                    title = atype
                    # Nicely format params dict
                    detail_lines = [f"{k}: {v}" for k, v in params.items()]
                    reason = getattr(action, 'reason', '')
                    confidence = getattr(action, 'confidence', None)
                    if confidence is not None:
                        detail_lines.append(f"confidence: {confidence:.2f}")
                    if reason:
                        detail_lines.append(f"reason: {reason}")
                    lbl_t.setText(title)
                    lbl_t.setStyleSheet(f"font-weight: bold; color: {border_col};")
                    lbl_d.setText("\n".join(detail_lines))
                else:
                    # Legacy MixAction
                    target = getattr(action, 'target', '')
                    value = getattr(action, 'value', '')
                    reason = getattr(action, 'reason', '')
                    lbl_t.setText(f"{atype}: {target}")
                    lbl_t.setStyleSheet(f"font-weight: bold; color: {border_col};")
                    lbl_d.setText(f"Value: {value}\nReason: {reason}")
            else:
                # Reset
                frame.setStyleSheet("background-color: #222831; border-radius: 8px; border: 1px solid #393E46;")
                lbl_t.setText("NO ACTION")
                lbl_t.setStyleSheet("font-weight: bold; color: #AAAAAA;")
                lbl_d.setText("System monitoring...")

    def closeEvent(self, event):
        self.audio_stream.stop()
        event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = ElyonXMainWindow()
    window.show()
    sys.exit(app.exec())
