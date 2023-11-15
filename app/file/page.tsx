"use client";

import { generateAES, generateID, generatePassword, encryptTransfer, hashPassword } from 'solun-general-package';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faEyeSlash, faCloudUploadAlt, faQuestionCircle, faLink, faRefresh } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link';
import axios from 'axios';
import Header from '@/components/header'
import Footer from '@/components/footer'
import toast, { Toaster } from 'react-hot-toast';

function UploadFile() {
  const [bruteforceSafe, setBruteforceSafe] = useState(false);
  const [exampleLink, setExampleLink] = useState('');
  const [endToEndEncryption, setEndToEndEncryption] = useState(false);

  const [uploadCreated, setUploadCreated] = useState(false);
  const [uploadLink, setUploadLink] = useState('');

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [securityIndicator, setSecurityIndicator] = useState("Not Secure");
  const [showTooltip, setShowTooltip] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState(0);

  const handleBruteforceToggle = () => {
    setBruteforceSafe(!bruteforceSafe);
  };

  const handleEndToEndToggle = () => {
    setEndToEndEncryption(!endToEndEncryption);
  };

  useEffect(() => {
    const generateLink = async () => {
      let link = '';

      if (bruteforceSafe) {
        const id = await generateID(true);
        link += id;
      } else {
        const id = await generateID(false);
        link += id;
      }

      if (endToEndEncryption) {
        const aesKey = await generateAES();
        link += `/${aesKey}`;
      }
      setExampleLink(link);
    };

    generateLink();
  }, [bruteforceSafe, endToEndEncryption]);

  useEffect(() => {
    if (endToEndEncryption || password !== "") {
      setSecurityIndicator("Secure");
    } else if (bruteforceSafe) {
      setSecurityIndicator("Okay");
    } else {
      setSecurityIndicator("Not Secure");
    }
  }, [bruteforceSafe, endToEndEncryption, password]);

  const handlePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  const handlePasswordChange = (event : any) => {
    setPassword(event.target.value);
  };

  async function handlePasswordGenerator () {
    const generatedPassword = await generatePassword(12);
    const field = document.getElementById('password') as any;
    field.value = generatedPassword;
    handlePasswordChange({target: {value: generatedPassword}});
  };

  const MAX_FILE_SIZE = 2.5 * 1024 * 1024 * 1024; // 2.5GB in bytes

  const handleFileChange = (event: any) => {
    const file = event.target.files[0]; // assuming single file upload
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds the maximum limit of 2.5GB');
      return;
    }
    setFiles([file]);
  };
  
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as typeof e.target & {
      bruteforceSafe: { checked: boolean };
      password: { value: string };
      endToEndEncryption: { checked: boolean };
      autoDeletion: { value: string };
    };

    setIsUploading(true);

    const bruteforceSafe = target.bruteforceSafe.checked;
    const password = target.password.value;
    const endToEndEncryption = target.endToEndEncryption.checked;

    const passwordSet = password !== "";
    const encrypted_password = passwordSet ? await hashPassword(password) : null;

    if (files.length > 0) {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('bruteforceSafe', bruteforceSafe.toString());
      formData.append('password', encrypted_password);
      formData.append('endToEndEncryption', endToEndEncryption.toString());
      formData.append('autoDeletion', target.autoDeletion.value);

      const config = {
        onUploadProgress: function(progressEvent: ProgressEvent) {
          var percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percentCompleted === 100) {
            toast('Processing your file... This may take a while');
          }
          setUploadPercentage(percentCompleted);
        }
      };
      
      try {
        // @ts-ignore Config is not assignable to type AxiosRequestConfig
        const response = await axios.post(process.env.NEXT_PUBLIC_API_DOMAIN + '/file/upload', formData, config);
        
        const data = await response.data;
        if (response.status === 200) {
          setUploadLink(data.link);
          setUploadCreated(true);
        } else {
          toast.error(data.message);
        }
      } catch (err) {
        toast.error('There was an error uploading your file');
      }
    }
    setIsUploading(false);
  };


  return (
    <>
    <Header />
    <div className="flex items-center justify-center py-8 px-2 md:min-h-screen">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
        }}
      />
      <div className="bg-slate-800 p-5 rounded-lg shadow-md w-full max-w-md md:mb-96 mb-40">
        {!uploadCreated ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-gray-100">
                Upload File
              </h1>
              <div className="flex items-center">
                  <button
                    className={`text-white font-bold px-3 py-1 rounded-full hidden md:block transform transition duration-200 hover:scale-105 ml-auto ${
                              securityIndicator === "Not Secure"
                                ? "bg-red-500 hover:bg-red-600"
                                : securityIndicator === "Okay"
                                ? "bg-yellow-500 hover:bg-yellow-600"
                                : "bg-green-500 hover:bg-green-600"
                              }`
                            }
                          onMouseEnter={() => setShowTooltip(true)}
                          onMouseLeave={() => setShowTooltip(false)}
                  >                
                  {securityIndicator}
                  {showTooltip && 
                    <div className="absolute w-64 top-full left-1/2 transform -translate-x-1/2 bg-black text-white p-2 text-md rounded-md shadow-lg mt-2">
                      The Security Indicator provides real-time updates on your chosen security settings.
                    </div>
                  }
                </button>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-3 py-1 rounded-full transform transition duration-200 hover:scale-110 ml-3"
                  onClick={() => setShowHelp(prevState => !prevState)}
                >
                  <FontAwesomeIcon icon={faQuestionCircle} />
                </button>
              </div>
            </div>
            {showHelp && (
              <div className="mb-4">
                <p className="text-slate-300">
                  Here you can upload a file to Solun. The file will be encrypted with AES-256 and stored on our servers.
                </p>
              </div>
              )}
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-center border-2 border-blue-500 h-64 rounded-2xl mb-4">
                  <input
                    type="file"
                    name="files"
                    id="files"
                    accept="*"
                    className="absolute opacity-0 h-64 w-full max-w-sm cursor-pointer"
                    onChange={handleFileChange}
                  />
                <div className="flex flex-col items-center text-center justify-center">
                  <FontAwesomeIcon icon={faCloudUploadAlt} size="6x" color="#3B82F6" />
                  <p className="text-slate-300">Drag and drop your file here or click to browse</p>
                  <p className="text-slate-400 text-sm">Max file size: 2.5GB</p>
                </div>
              </div>
              {files.length > 0 && (
                <div className="mt-4">
                  <span className="text-slate-300">Selected File:</span>
                  <br />
                  <span className="text-slate-400 break-all">Name: {files[0].name}</span>
                  <br />
                  <span className="text-slate-400">Size: {(files[0].size / 1000000).toFixed(2)} MB</span>
                </div>
              )}
              <div className="flex justify-between flex-wrap items-start mt-4">
                <div className="flex flex-col">
                    <div className="relative flex items-center mb-2">
                      <input
                        type={passwordVisible ? "text" : "password"}
                        id="password"
                        name="password"
                        className="bg-slate-950 text-white rounded-lg block p-3 pe-16 w-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 focus:shadow-md focus:shadow-blue-700 transition duration-200"
                        placeholder="Optional Password"
                        minLength={1}
                        onChange={handlePasswordChange}
                      />
                      {password.length > 0 && (
                        <div className="h-6 w-6 text-slate-300 absolute right-8 cursor-pointer hover:text-blue-500">
                          <FontAwesomeIcon id="pwd-icon" icon={passwordVisible ? faEye : faEyeSlash}
                          onClick={handlePasswordVisibility}
                          />
                        </div>
                      )}
                      <div className="h-6 w-6 text-slate-300 absolute right-2 cursor-pointer hover:text-blue-500">
                        <FontAwesomeIcon icon={faRefresh} 
                        onClick={handlePasswordGenerator}
                        />
                      </div>
                    </div>
                    {showHelp && (
                    <div className="mb-4">
                      <p className="text-slate-300 w-56 text-sm">
                        You can optionally set a password for your file.
                      </p>
                    </div>
                    )}
                  </div>
                  <button
                    id="submit"
                    disabled={isUploading}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-3 rounded transition duration-200"
                  >
                    {isUploading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-white">{uploadPercentage}%</span>
                      </div>
                    ) : (
                      'Start Upload'
                    )}
                  </button>
              </div>
              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  id="bruteforceSafe"
                  onChange={handleBruteforceToggle}
                  className="mr-2 w-3.5 h-3.5 text-blue-600 bg-gray-100 border-gray-300 rounded"
                />
                <label htmlFor="bruteforceSafe" className="text-white">
                  Bruteforce Safe (90 Chars)
                </label>
              </div>
              {showHelp && (
                <div className="mb-4">
                  <p className="text-slate-300 text-sm">
                    This option allows you to create a file link that is 90 characters long. This makes it impossible to bruteforce the link.
                  </p>
                </div>
              )}
              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  id="endToEndEncryption"
                  onChange={handleEndToEndToggle}
                  className="mr-2 w-3.5 h-3.5 text-blue-600 bg-gray-100 border-gray-300 rounded"
                />
                <label htmlFor="endToEndEncryption" className="text-white">
                  End-to-End Encryption
                </label>
              </div>
              {showHelp && (
                <div className="mb-4">
                  <p className="text-slate-300 text-sm">
                    This option enables end-to-end encryption, which means we don't store the secret key which is used to encrypt your file. This means that we cannot decrypt your file.
                  </p>
                </div>
              )}
              <div className="flex flex-col mt-4">
                <div className="relative">
                  <select
                    defaultValue={"download"}
                    name="autoDeletion"
                    id="autoDeletion"
                    className="bg-slate-950 text-white rounded-lg block p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 focus:shadow-md focus:shadow-blue-700 transition duration-200"
                  >
                    <option disabled hidden value="download">Choose Auto Deletion</option>
                    <option value="download">1 Download</option>
                    <option value="1d">1 Day</option>
                    <option value="1w">1 Week</option>
                    <option value="1m">1 Month</option>
                    <option value="3m">3 Months</option>
                    <option value="6m">6 Months</option>
                    <option value="1y">1 Year</option>
                    <option value="never">Never</option>
                  </select>
                </div>
                {showHelp && (
                <div className="mb-4">
                  <p className="text-slate-300 text-sm">
                    This option allows you to set an auto deletion time for your file. After the file has been downloaded or the time has passed, the file will be deleted from our servers.
                  </p>
                </div>
              )}
              </div>
              <div className="mt-4">
                <span className="text-slate-300">Example Link:</span>
                <br />
                <span className="text-slate-400">{process.env.NEXT_PUBLIC_MAIN_DOMAIN}/file/</span>
                <a
                  rel="noopener noreferrer"
                  className="text-blue-600 break-all"
                >
                  {exampleLink}
                </a>
              </div>
              {showHelp && (
                <div className="mb-4">
                  <p className="text-slate-300 text-sm">
                    With this example link you can see how your file link will look like. (This is not a real link)
                  </p>
                </div>
              )}
              <div className="flex items-center justify-center flex-col mt-4 gap-2">
              <Link href="how-file" className="text-center text-blue-500 text-sm block">
                <FontAwesomeIcon icon={faLink} /> Learn More
              </Link>
              <Link href="features">
                <span className="ml-2 inline-block bg-blue-500 text-white text-xs px-2 py-1 rounded-full">Production Beta</span>
              </Link>
            </div>
            </form>
          </>
        ) : (
          <>
          <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-gray-100">
                Your File has been uploaded!
              </h1>
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-3 py-1 rounded-full transform transition duration-200 hover:scale-110"
                onClick={() => setShowHelp(prevState => !prevState)}
              >
                <FontAwesomeIcon icon={faQuestionCircle} />
              </button>
            </div>
            {showHelp && (
              <div className="mb-4">
                <p className="text-slate-300">
                  Your file has been uploaded to Solun. You can now share the link with your friends. <br/><br/> (The file will be deleted after the first download or after the auto deletion time has passed)
                </p>
              </div>
              )}
            <div className="mb-4">
              <input
                type="text"
                value={`${uploadLink}`}
                readOnly
                className="bg-slate-950 text-white w-full p-2 rounded-lg blur-[3px] hover:blur-none transition duration-300 focus:outline-none"
              />
            </div>
            <button
              id="copy"
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded transition duration-200 shadow-md ml-2"
              onClick={() => {
                navigator.clipboard.writeText(`${uploadLink}`);
                const copyButton = document.getElementById('copy') as HTMLButtonElement;
                copyButton.innerHTML = "Copied!";
                setTimeout(() => {
                  copyButton.innerHTML = "Copy Link";
                }, 1200);
              }}
            >
              Copy Link
            </button>
          </>
        )}
      </div>
    </div>
    <Footer />
    </>
  );
}

export default UploadFile;