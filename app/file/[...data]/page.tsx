"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import toast, { Toaster } from 'react-hot-toast';
import Header from '@/components/header'
import Footer from '@/components/footer'
import { detect } from 'detect-browser';

function ViewFile({ params }: { params: { data: string[] } }) {
  const id = params.data[0];
  const secret = params.data[1];

  const [passwordProtected, setPasswordProtected] = useState(false);
  const [fileExists, setFileExists] = useState(false);
  const [password, setPassword] = useState("");
  const [fileLink, setFileLink] = useState("");
  const [file_raw_path, setFile_raw_path] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [fileType, setFileType] = useState("");
  const [showFile, setShowFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadProcess, setDownloadProcess] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [deleteButton, setDeleteButton] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [encryptButton, setEncryptButton] = useState(false);

  const router = useRouter();
  const uploadNewFile = () => {
    router.push("/file");
  };

  async function checkId(id: string) {
    const data = {
      id,
    };
    const res = await fetch(process.env.NEXT_PUBLIC_API_DOMAIN + '/file/check', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    const notFoundField = document.getElementById("notFoundField")!;
    if (!res.ok) {
      notFoundField.innerHTML = "File not found.";
      setFileExists(false);
    } else {
      setFileExists(true);
      setPasswordProtected(result.password);
    }
  }

  async function deleteFile(id: string, secretKey: string, forceDeleteOn1Download: boolean, encryptAgain: boolean, mobile?: boolean) {
    const data = {
      id,
      secret: secretKey,
      forceDeleteOn1Download,
      encryptAgain,
      mobile,
    };
    const res = await fetch(process.env.NEXT_PUBLIC_API_DOMAIN + "/file/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      //document.getElementById("deletionField")!.innerHTML = result.message;
      toast.error(result.message);
    } else {
      //document.getElementById("deletionField")!.innerHTML = result.message;
      toast.success(result.message);
    }
  }

  async function handleViewFile(secretKey: string) {
    const browser = detect();
    if (browser) {
      if (browser.os === 'iOS') {
        setIsMobile(true);
      }
    }
    setLoading(true);
    setError("");
    const data = {
      id,
      password,
      secret: secretKey,
    };
    const res = await fetch(process.env.NEXT_PUBLIC_API_DOMAIN + '/file/receive', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      toast.error(result.message);
    } else {
      setFileLink(result.link);
      setFile_raw_path(result.file_raw_path);
      setFileName(result.name);
      setFileSize((result.size / 1000000).toFixed(2) + " MB");
      setFileType(result.type);
      setShowFile(true);

      //await deleteFile(id, secretKey, false, false);
    }
    setLoading(false);
  }

  async function handleDownloadFile(id: string, secret: string) {
    setDownloadLoading(true);
    setDownloadProcess('Starting...');
    try {
      if (downloaded) {
        return;
      }
  
      const data = {
        id,
        secret,
      };
  
      const response = await fetch(process.env.NEXT_PUBLIC_API_DOMAIN + '/file/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
  
      if (!response.ok) {
        toast.error('Something went wrong, please try again later');
        setDownloadLoading(false);
        return;
      }
      
      if (!response.body) {
        toast.error('Something went wrong, please try again later');
        setDownloadLoading(false);
        return;
      }
  
      const reader = response.body.getReader();
      const contentLength = +response.headers.get('File-Size')!;
      let receivedLength = 0;
  
      const chunks = [];
      while(true) {
        const {done, value} = await reader.read();
  
        if (done) {
          break;
        }
  
        chunks.push(value);
        receivedLength += value.length;
        const percent = ((receivedLength / contentLength) * 100).toFixed(0);
        setDownloadProcess(`${percent}%`);
        //downloadButton.innerHTML = `${percent}%`;
      }
  
      let blob = new Blob(chunks);
      const fileName = response.headers.get("Content-Disposition")?.split("filename=")[1].replace(/"/g, "") || "file";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
  
      if (!isMobile) {
        await deleteFile(id, secret, true, true);
      }
      
      if (response.headers.get("Deletion") === 'download') {
        setDownloaded(true);
        setDownloadLoading(false);
        if (isMobile) {
          setDeleteButton(true);
        }
      } else {
        setDownloadLoading(false);
        setDownloaded(false);
        if (isMobile) {
          setEncryptButton(true);
        }
      }
    } catch (err) {
      toast.error('Something went wrong, please try again later');
      setDownloadLoading(false);
      setDownloaded(false);
    }
  }

  async function handleDeleteFile(id: string, secret: string) {
    setDeleteLoading(true);
    await deleteFile(id, secret, true, true);
    setDeleteLoading(false);
    setDeleteButton(false);
  }

  async function handleEncryptFile(id: string, secret: string) {
    await deleteFile(id, secret, true, true, true);
    setEncryptButton(false);
  }

  useEffect(() => {
    checkId(id);
  }, []);

  function renderButtonContent() {
    if (loading) {
      return (
        <div className="flex items-center">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-white">Loading</span>
        </div>
      );
    } else {
      return "View File";
    }
  }

  return (
    <>
    <Header />
    <div className="flex items-center justify-center py-8 px-2 md:min-h-screen">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000
        }}
      />
      <div className="bg-slate-800 p-5 rounded-lg shadow-md w-full max-w-md md:mb-96 mb-40">
        {fileExists ? (
          showFile ? (
            <div>
              <h1 className="text-2xl font-bold mb-4 text-gray-100">
                Your File
              </h1>
              <div className="p-4 mb-4 text-white rounded-lg bg-gradient-to-r from-blue-600 to-blue-800">
                <p className="mb-2 break-all">
                  <strong>Filename:</strong> {fileName}
                </p>
                <p className="mb-2">
                  <strong>Filesize:</strong> {fileSize}
                </p>
                <p className="mb-2 break-all">
                  <strong>Filetype:</strong> {fileType}
                </p>
              </div>
              <div className="flex justify-center">
                {encryptButton ? (
                  <button
                    id="encryptButton"
                    onClick={() => {
                      handleEncryptFile(id, secret);
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold text-lg px-8 py-4 rounded transition duration-200 shadow-lg inline-block text-center cursor-pointer min-w-max w-58"
                    style={{ minWidth: '180px' }}
                  >
                    Encrypt File
                  </button>
                ) : !deleteButton ? (
                  <button
                    id="downloadButton"
                    onClick={() => {
                      handleDownloadFile(id, secret);
                    }}
                    disabled={downloadLoading || downloaded}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold text-lg px-8 py-4 rounded transition duration-200 shadow-lg inline-block text-center cursor-pointer min-w-max w-58"
                    style={{ minWidth: '180px' }}
                  >
                    {downloadLoading ? (
                      <>
                        <FontAwesomeIcon icon={faCircleNotch} className="animate-spin" />
                        <span className="ml-2">{downloadProcess}</span>
                      </>
                    ) : (
                      downloaded ? "Downloaded" : "Download File"
                    )}
                  </button>
                ) : (
                  <button
                    id="deleteButton"
                    onClick={() => {
                      handleDeleteFile(id, secret);
                    }}
                    disabled={deleteLoading}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold text-lg px-8 py-4 rounded transition duration-200 shadow-lg inline-block text-center cursor-pointer min-w-max w-58"
                    style={{ minWidth: '180px' }}
                  >
                    {deleteLoading ? (
                      <>
                        <FontAwesomeIcon icon={faCircleNotch} className="animate-spin" />
                        <span className="ml-2">Deleting...</span>
                      </>
                    ) : (
                      "Delete File"
                    )}
                  </button>
                )}
              </div>
              <div className="flex flex-col justify-center italic items-center mt-4 flex-wrap">
                <p
                  id="deletionField"
                  className="text-red-500 text-center mb-4"
                ></p>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm px-4 py-2 rounded transition duration-200 shadow-md ml-2 mt-2"
                  onClick={() => uploadNewFile()}
                >
                  Upload another file
                </button>
              </div>
            </div>
          ) : passwordProtected ? (
            <div className="flex items-center justify-center flex-wrap flex-col">
              <h1 className="text-2xl font-bold mb-4 text-gray-100">
                Enter Password
              </h1>
              <input
                type="password"
                className="bg-slate-950 text-white rounded-lg block p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 focus:shadow-md focus:shadow-blue-700 transition duration-200"
                placeholder="Password"
                minLength={1}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded transition duration-200 shadow-md ml-2 mt-2"
                onClick={() => handleViewFile(secret)}
                disabled={loading}
              >
                {renderButtonContent()}
              </button>
            </div>
          ) : (
            <div className="flex justify-center items-center">
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded transition duration-200 shadow-md mt-2"
                onClick={() => handleViewFile(secret)}
                disabled={loading}
              >
                {renderButtonContent()}
              </button>
            </div>
          )
        ) : (
          <p id="notFoundField" className="text-white">
            Checking your link...
          </p>
        )}
        {error && (
          <p className="text-red-500 mt-2 text-center break-all">{error}</p>
        )}
      </div>
    </div>
    <Footer />
    </>
  );
}

export default ViewFile;
