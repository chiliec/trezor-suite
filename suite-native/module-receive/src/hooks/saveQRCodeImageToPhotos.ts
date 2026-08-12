// This is the Android implementation selected by Metro as the unsuffixed fallback.
import type { SaveQRCodeImageToPhotos } from './saveQRCodeImageToPhotos.types';

export const saveQRCodeImageToPhotos: SaveQRCodeImageToPhotos = _getQRCodeImageURI =>
    Promise.resolve('notSupported');
