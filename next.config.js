/** @type {import("next").NextConfig} */
const nextConfig = {
    experimental: { serverComponentsExternalPackages: ["mongoose"], mdxRs: true, },
    webpack(config) {
        config.experiments = { ...config.experiments, topLevelAwait: true };
        return config;
    }
};

const withMDX = require('@next/mdx')();
module.exports = withMDX(nextConfig);