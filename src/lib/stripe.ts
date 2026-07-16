import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2024-06-20",
});

export function priceIdForEnv(envName: string) {
  const id = process.env[envName];
  if (!id) throw new Error(`Missing Stripe price env var: ${envName}`);
  return id;
}
