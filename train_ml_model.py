import os
from src.ml.dataset import KickDataset
from src.ml.model import EQCompressorGateNet, Trainer
import numpy as np
from src.utils.config import BASE_DIR


def main():
    dataset_path = os.path.join(BASE_DIR, 'data', 'kick_samples')
    ds = KickDataset(dataset_path)
    print('Loading samples...')
    ds.load_samples()
    if not ds.samples:
        print('No samples found. Place WAV files under:', dataset_path)
        return

    print(f'Loaded {len(ds.samples)} samples')
    print('Extracting features...')
    ds.extract_features_batch()
    ds.generate_targets()
    X, y = ds.get_dataset()
    print('Feature shape:', X.shape, 'Target shape:', y.shape)

    model = EQCompressorGateNet(input_size=X.shape[1], hidden_size=128, output_size=y.shape[1])
    trainer = Trainer(model)
    trainer.train(X, y, epochs=80, batch_size=8)

    model_dir = os.path.join(BASE_DIR, 'models')
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, 'kick_eq_comp_gate.pth')
    trainer.save(model_path)
    print('Saved trained model to', model_path)


if __name__ == '__main__':
    main()
