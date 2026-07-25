import QuickPasteClient from "./quick-paste-client";
import { probeResource } from "../../../lib/server-api";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

async function getInitialState(id: string): Promise<"exists" | "not-found" | "checking"> {
  const result = await probeResource(`/api/paste/${id}`);
  return result === "unknown" ? "checking" : result;
}

export default async function QuickPastePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const initialState = await getInitialState(id);
  return <QuickPasteClient id={id} initialState={initialState} />;
}
