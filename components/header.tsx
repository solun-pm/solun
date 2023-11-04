"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const goToLogin = () => {
    location.href = process.env.NEXT_PUBLIC_AUTH_DOMAIN+"/login";
  };

  const goToSignup = () => {
    location.href = process.env.NEXT_PUBLIC_AUTH_DOMAIN+"/signup";
  };

  return (
    <header className="bg-gray-950 py-4">
      <div className="container mx-auto flex justify-between items-center px-4">
        <Link href="/">
        <div className="text-gray-100 font-bold text-xl">Solun</div>
        </Link>
        <div className="hidden md:flex space-x-4">
          <Link href="/msg" className="text-gray-300 hover:text-white transition duration-200">Encrypt Message
          </Link>
          <Link href="/file" className="text-gray-300 hover:text-white transition duration-200">Upload File
          </Link>
          <Link href="/ip" className="text-gray-300 hover:text-white transition duration-200">IP Info
          </Link>
        </div>
        <div className="hidden md:flex">
          <button onClick={goToLogin} className="border border-blue-500 hover:bg-blue-500 hover:text-white text-blue-500 font-semibold px-4 py-2 rounded-l transition duration-200 mr-2">
            Sign In
          </button>
          <button onClick={goToSignup} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-r transition duration-200">
            Sign Up
          </button>
        </div>
        <div className="md:hidden">
          <button onClick={toggleMenu} className="text-gray-300 hover:text-white transition duration-200">
            <FontAwesomeIcon icon={faBars} />
          </button>
        </div>
      </div>
      {isMenuOpen && (
        <div className="container mx-auto px-4 mt-4">
          <nav className="md:hidden bg-gray-900 rounded-lg p-4 space-y-4">
            <Link href="/msg" className="text-gray-300 hover:text-white transition duration-200 block" onClick={toggleMenu}>Encrypt Message
            </Link>
            <Link href="/file" className="text-gray-300 hover:text-white transition duration-200 block" onClick={toggleMenu}>Upload File
            </Link>
            <Link href="/ip" className="text-gray-300 hover:text-white transition duration-200 block" onClick={toggleMenu}>IP Info
            </Link>
            <button onClick={goToLogin} className="border border-blue-500 hover:bg-blue-500 hover:text-white text-blue-500 font-semibold px-4 py-2 rounded-l transition duration-200 mr-2">
              Sign In
            </button>
            <button onClick={goToSignup} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-r transition duration-200">
              Sign Up
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
