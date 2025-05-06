"use client";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between bg-gray-100 p-4">
      <h1 className="text-2xl font-bold">Briq</h1>
      <button className="bg-blue-500 text-white px-4 py-2 rounded">
        Connect Wallet
      </button>
    </nav>
  );
}