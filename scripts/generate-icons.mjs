import sharp from "sharp";

const src = "public/prosper-hotel-logo.jpeg";

const targets = [
  { out: "src/app/icon.png", size: 512 },
  { out: "src/app/apple-icon.png", size: 180 },
  { out: "public/icon-192.png", size: 192 },
  { out: "public/icon-512.png", size: 512 },
];

for (const { out, size } of targets) {
  await sharp(src).resize(size, size, { fit: "cover" }).png().toFile(out);
  console.log("wrote", out);
}
