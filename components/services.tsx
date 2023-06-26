"use client";

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment, faFile, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';

const ServiceCard = ({ icon, title, description, buttonText, additionalDetails, buttonLink } : any) => {
  const [showDetails, setShowDetails] = useState(false);

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  const router = useRouter();

  const goToService = (link: string) => {
    router.push(link);
  };

  return (
    <div className="bg-slate-800 shadow-lg rounded-lg p-6 flex flex-col items-center justify-center max-w-md mx-auto">
      <FontAwesomeIcon icon={icon} className="text-4xl mb-4 text-blue-600" />
      <h2 className="text-2xl font-bold mb-4 text-gray-100">{title}</h2>
      <p className="text-center mb-6 text-gray-300">{description}</p>
      {showDetails && (
        <div className="text-left text-gray-300">
            <hr className="border-gray-700 mb-6" />
                <p>{additionalDetails}</p>
            <hr className="border-gray-700 mt-6 mb-6" />
        </div>
      )}
      <div className="flex">
        <button
          className="bg-transparent border-2 border-white text-white font-semibold px-6 py-3 rounded hover:bg-blue-400 hover:border-blue-400 transition duration-200 shadow-md"
          onClick={toggleDetails}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded transition duration-200 shadow-md ml-2"
            onClick={() => goToService(buttonLink)}
          >
            {buttonText}
          </button>
      </div>
    </div>
  );
};

const Services = () => {
    const services = [
      {
        icon: faComment,
        title: 'Encrypted Messages',
        description: 'Send encrypted messages to your friends via a secure link. Messages are automatically deleted after they are viewed.',
        buttonText: 'Use Service',
        buttonLink: '/msg',
        additionalDetails: (
          <div>
            <p>The message system ensures high security by encrypting messages with AES-256 when saved.
              They are only decrypted when viewed by the recipient.<br/><br/>
              Each message has a unique AES 32-byte secret key.
              After being read, messages are permanently deleted from the system, ensuring they cannot be restored.<br/><br/>
              This guarantees a secure and confidential communication platform.</p>
          </div>
        ),
      },
      {
        icon: faFile,
        title: 'Encrypted Upload',
        description: 'Share files securely with adjustable online duration. Simply upload your files, define how long they should be available, and send the secure link to your recipient.',
        buttonText: 'Use Service',
        buttonLink: '/file',
        additionalDetails: (
          <div>
            <p>The file is stored in our system on encrypted disks with government-certified (SED) security for the chosen duration and is immediately removed upon expiration.</p><br/>
            <p>Each file has a unique AES 32-byte secret key.</p>
          </div>
        ),
      },
      {
        icon: faEnvelope,
        title: 'Private Mail',
        description: 'Get your own mailbox with a custom username with one of our domains - or use your own. Send and receive emails from anywhere.',
        buttonText: 'Get Started',
        buttonLink: process.env.NEXT_PUBLIC_AUTH_DOMAIN+'/signup',
        additionalDetails: (
          <div>
            <li>Choose a domain and username.</li>
            <li>Receive and send emails from anywhere.</li>
            <li>1GB of storage space.</li>
            <li>Send up to 100 messages per day.</li>
            <li>Manage your own domain with Solun.</li>
          </div>
        ),
      },
    ];  

  return (
    <div id="services" className="container mx-auto px-4 py-8 md:py-16" style={{ background: '#11141f' }}>
      <h2 className="text-4xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-600">Services</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center justify-center">
        {services.map((service, index) => (
          <ServiceCard key={index} {...service} />
        ))}
      </div>
    </div>
  );
};

export default Services;