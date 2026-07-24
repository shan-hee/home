/**
 * Get Color
 * Made by NanoRocky and Google Jules
 * 这个模块用于从背景图片实时获取主色调以变更背景色
 * @description
 * @param {HTMLImageElement} img
 * @returns {Promise<number>}
 */
export const getBrightness = (img: HTMLImageElement): Promise<number> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            return reject(new Error('无法获取 canvas 的 2d context'));
        };
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (width <= 0 || height <= 0) {
            reject(new Error('图片尺寸无效'));
            return;
        }
        const scale = Math.min(1, 64 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        try {
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let totalBrightness = 0;
            let samples = 0;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const alpha = data[i + 3] / 255;
                if (alpha === 0) continue;
                totalBrightness += ((r * 299 + g * 587 + b * 114) / 1000) * alpha;
                samples += alpha;
            };
            if (samples === 0) throw new Error('图片没有可采样像素');
            resolve(totalBrightness / samples);
        } catch {
            reject(new Error('无法处理图片以获取颜色'));
        };
    });
};
