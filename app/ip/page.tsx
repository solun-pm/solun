"use client";

import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faEyeSlash, faQuestionCircle, faLink, faRefresh } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link';
import Header from '@/components/header'
import Footer from '@/components/footer'
import toast, { Toaster } from 'react-hot-toast';

const LoadingPlaceholder = () => (
  <span className="text-gray-500">Loading...</span>
);

const ipInformations = () => {
  const [ipData, setIpData] = useState(null) as any;

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(response => response.json())
      .then(data => {
        if (data) {
          setIpData(data);
        } else {
          toast.error('Error while fetching IP informations');
        }
      });
  }, []);

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
      <div className="bg-slate-800 p-6 rounded-lg shadow-md w-full max-w-7xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl first-line:text-white">
            IP Address: <br />
            <span className="text-4xl text-blue-600 hover:text-blue-700 transition-all font-semibold">{ipData?.ip || <LoadingPlaceholder />}</span>
          </h2>
          <h4 className="text-lg text-gray-400">
            Network: <br />
            <span className="text-2xl text-gray-500">{ipData?.network || <LoadingPlaceholder />}</span>
          </h4>
        </div>
        <div className="text-white grid md:grid-cols-2 gap-4">
          <div>
            <p><strong>Country:</strong> {ipData?.country_name || <LoadingPlaceholder />} ({ipData?.country_code || <LoadingPlaceholder />})</p>
            <p><strong>Region:</strong> {ipData?.region || <LoadingPlaceholder />}</p>
            <p><strong>City:</strong> {ipData?.city || <LoadingPlaceholder />} {ipData?.postal || <LoadingPlaceholder />}</p>
          </div>
          <div>
            <p><strong>Latitude:</strong> {ipData?.latitude || <LoadingPlaceholder />}</p>
            <p><strong>Longitude:</strong> {ipData?.longitude || <LoadingPlaceholder />}</p>
            <p><strong>Timezone:</strong> {ipData?.timezone || <LoadingPlaceholder />}</p>
          </div>
          <div className="md:col-span-2">
            <p><strong>Organization:</strong> {ipData?.org || <LoadingPlaceholder />}</p>
            <p><strong>ASN:</strong> {ipData?.asn || <LoadingPlaceholder />}</p>
          </div>
        </div>
      </div>
    </div>
    <Footer />
  </>
);
}

export default ipInformations;