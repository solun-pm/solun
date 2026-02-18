import QuickPasteClient from "./quick-paste-client";

export default async function QuickPastePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <QuickPasteClient id={id} />;
}
