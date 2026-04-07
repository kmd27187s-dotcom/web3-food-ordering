import { MemberOrderingWorkspace } from "@/components/member-ordering-workspace";

export default async function MemberOrderingSubmittedDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  return <MemberOrderingWorkspace stage="submitted" proposalId={Number(proposalId)} />;
}
