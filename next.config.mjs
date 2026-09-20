/** @type {import('next').NextConfig} */
const secure = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
];
const nextConfig = {
  async headers() {
    return [
      { source: "/tracker", headers: [...secure, { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
      { source: "/", headers: [...secure, { key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};
export default nextConfig;
