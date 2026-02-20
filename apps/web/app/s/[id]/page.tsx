import SecurePasteClient from "./secure-paste-client";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function SecurePastePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <SecurePasteClient id={id} />;
}
