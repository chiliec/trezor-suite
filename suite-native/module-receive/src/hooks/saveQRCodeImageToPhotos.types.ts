export type SaveQRCodeImageToPhotosResult = 'saved' | 'permissionDenied' | 'notSupported';

export type SaveQRCodeImageToPhotos = (
    getQRCodeImageURI: () => Promise<string>,
) => Promise<SaveQRCodeImageToPhotosResult>;
