import { ProductsReportPage } from "../products/page";

export default async function ProductRankingReportPage(props: {
  searchParams: Promise<{
    start?: string;
    end?: string;
    store?: string;
    product?: string;
  }>;
}) {
  return <ProductsReportPage {...props} rankingOnly />;
}
