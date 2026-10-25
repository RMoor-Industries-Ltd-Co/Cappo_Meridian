import { Suspense } from "react";
import { CommerceOperationsBoard } from "@/components/commerce/CommerceOperationsBoard";

export default function CommerceOperationsPage() {
  return (
    <Suspense fallback={null}>
      <CommerceOperationsBoard />
    </Suspense>
  );
}
