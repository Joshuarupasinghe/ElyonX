import logging
import sys
from app.core.config import settings

def setup_logging():
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ],
        force=True
    )
    
    for lib in ["uvicorn", "asyncio", "pydantic"]:
        logging.getLogger(lib).setLevel(logging.WARNING)
        
    logging.getLogger("elyonx.main").setLevel(log_level)
