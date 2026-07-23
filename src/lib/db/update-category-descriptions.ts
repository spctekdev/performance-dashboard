import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { Category } from "./entities";

const descriptions: Record<string, string> = {
  "Advertising & PPC": "Planning, running, and improving paid marketplace advertising campaigns.",
  "Account Health & Reinstatement": "Monitoring marketplace compliance and restoring affected accounts or listings.",
  "Creative & Brand Content": "Creating marketplace visuals and brand content that improve discovery and conversion.",
  "Listing & Catalog Management": "Building, maintaining, and improving accurate marketplace product listings.",
  "Product Strategy": "Selecting, sourcing, testing, and positioning products for sustainable growth.",
  "Inventory Management": "Forecasting and controlling stock to protect availability and cash flow.",
  "Pricing & Revenue": "Improving price, promotion, and margin decisions across marketplaces.",
  "Testing & Experimentation": "Running controlled tests to validate changes and measure commercial impact.",
  "Creator Connection": "Building and managing creator partnerships that support marketplace demand.",
  "Walmart Marketplace": "Operating and growing product sales through Walmart Marketplace.",
  "eBay Marketplace": "Operating and growing product sales through eBay Marketplace.",
  "Etsy Marketplace": "Operating and growing product sales through Etsy Marketplace.",
  "Content Marketing": "Planning and producing useful content that attracts and converts audiences.",
  "Social Media": "Publishing and optimizing brand content across social channels.",
  SEO: "Improving technical and editorial visibility in organic search.",
  "Video Production": "Planning, producing, reviewing, and distributing effective video content.",
  "Google Ads PPC": "Building and optimizing Google Ads campaigns for efficient acquisition.",
  "Partnership Program": "Developing and operating mutually valuable commercial partnerships.",
  "Influencer Marketing": "Planning and measuring creator-led brand and acquisition campaigns.",
  "Website Development": "Building, testing, and maintaining accessible, performant websites.",
  "Email Marketing": "Growing and engaging audiences through targeted lifecycle email campaigns.",
  "Community Management": "Building trusted participation across relevant online communities.",
};

async function run() {
  const db = await AppDataSource.initialize();
  const repo = db.getRepository(Category);
  for (const [name, description] of Object.entries(descriptions)) {
    for (const category of await repo.findBy({ name })) await repo.update(category.id, { description });
  }
  const remaining = await repo.findBy({ description: "Place Holder" });
  console.log(`Updated category descriptions. Remaining placeholders: ${remaining.length}`);
  for (const category of remaining) console.log(`- ${category.id} ${category.name}`);
  await db.destroy();
}

run().catch(async (error) => {
  console.error("Category description update failed:", error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});
