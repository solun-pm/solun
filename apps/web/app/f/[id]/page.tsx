import FileDownloadClient from "./file-client";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function FileDownloadPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <FileDownloadClient id={id} />;
}
