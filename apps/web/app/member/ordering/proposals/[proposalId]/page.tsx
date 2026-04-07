import { MemberOrderingWorkspace } from "@/components/member-ordering-workspace";

export default async function MemberOrderingProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  return <MemberOrderingWorkspace stage="proposal" proposalId={Number(proposalId)} />;
}
