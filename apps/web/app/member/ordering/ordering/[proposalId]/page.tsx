import { MemberOrderingWorkspace } from "@/components/member-ordering-workspace";

export default async function MemberOrderingOrderingDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  return <MemberOrderingWorkspace stage="ordering" proposalId={Number(proposalId)} />;
}
