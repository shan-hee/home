import config from "@/../package.json";

export const parseVersion = (ver: string) => {
    const versionMatch = ver.match(/^(\d+\.\d+\.\d+)/);
    const isDevelopment = /\.dev\b/.test(ver);
    const isPreview = /\.pre\b/.test(ver);
    const isBeta = /\.beta\b/.test(ver);
    const channelMatch = ver.match(/\[([^\]]+)\]$/);
    let type: "preview" | "development" | "beta" | "release";
    if (isPreview) {
        type = 'preview';
    } else if (isDevelopment) {
        type = 'development'
    } else if (isBeta) {
        type = 'beta';
    } else {
        type = 'release';
    };
    const updateAuthor = channelMatch?.[1] !== 'imsyy' ? config.efua : config.author;
    return {
        version: versionMatch?.[1] || '0.0.0',
        type,
        channel: channelMatch?.[1] || 'imsyy',
        upa: updateAuthor
    };
};
