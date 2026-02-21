import QuickPasteClient from "./quick-paste-client";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getInitialState(id: string): Promise<"exists" | "not-found"> {
  try {
    const response = await fetch(`${API_URL}/api/paste/${id}`, {
      method: "HEAD",
      cache: "no-store"
    });
    return response.ok ? "exists" : "not-found";
  } catch {
    return "not-found";
  }
}

export default async function QuickPastePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const initialState = await getInitialState(id);
  return <QuickPasteClient id={id} initialState={initialState} />;
}
