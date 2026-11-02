import { decidePrice } from "./price_watch.ts";

const result = decidePrice({ productId: "sku-42", competitorUrl: "https://shop.example/items/42", ceiling: 50 }, 47.5);
if (!result.alert || result.observedPrice !== 47.5) throw new Error("A lower competitor price should raise an alert");
console.log("price decision test passed");
