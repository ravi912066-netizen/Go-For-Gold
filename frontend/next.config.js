/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    basePath: '/Go-For-Gold',
    assetPrefix: '/Go-For-Gold/',
    images: {
        unoptimized: true,
        domains: ['api.dicebear.com', 'avatars.githubusercontent.com'],
    },
    // Note: rewrites do not work with output: 'export'
};

module.exports = nextConfig;
