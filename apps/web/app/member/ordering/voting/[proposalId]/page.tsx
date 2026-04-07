import { MemberOrderingWorkspace } from "@/components/member-ordering-workspace";

export default async function MemberOrderingVotingDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  return <MemberOrderingWorkspace stage="voting" proposalId={Number(proposalId)} />;
}
