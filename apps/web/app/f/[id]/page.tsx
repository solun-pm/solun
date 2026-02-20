import FileDownloadClient from "./file-client";

export default async function FileDownloadPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <FileDownloadClient id={id} />;
}
