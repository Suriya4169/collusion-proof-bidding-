"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const [udyam, setUdyam] = useState("");
  const [gstin, setGstin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Mock login delay
    setTimeout(() => {
      // Save mock profile to localStorage
      localStorage.setItem("msme_profile", JSON.stringify({
        udyam,
        gstin,
        companyName: "Bharat Precision Engineering Pvt Ltd",
        turnover: 4850000,
        experience: 5,
        isRegisteredMSME: true
      }));
      
      setIsLoading(false);
      router.push("/marketplace");
    }, 800);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
          <span className="text-white font-bold text-2xl">M</span>
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-white">
          Sign in to your MSME account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Or{" "}
          <Link href="/" className="font-medium text-blue-500 hover:text-blue-400">
            return to home
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-800">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="udyam" className="block text-sm font-medium text-slate-300">
                Udyam Registration Number
              </label>
              <div className="mt-1">
                <input
                  id="udyam"
                  name="udyam"
                  type="text"
                  required
                  placeholder="e.g. UDYAM-XX-00-0000000"
                  value={udyam}
                  onChange={(e) => setUdyam(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-700 bg-slate-800 rounded-md shadow-sm placeholder-slate-500 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="gstin" className="block text-sm font-medium text-slate-300">
                GSTIN
              </label>
              <div className="mt-1">
                <input
                  id="gstin"
                  name="gstin"
                  type="text"
                  required
                  placeholder="15-character GSTIN"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-700 bg-slate-800 rounded-md shadow-sm placeholder-slate-500 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-700 rounded bg-slate-800"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-300">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-blue-500 hover:text-blue-400">
                  Forgot Udyam Number?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 transition-colors disabled:opacity-50"
              >
                {isLoading ? "Authenticating..." : "Sign in to Dashboard"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
