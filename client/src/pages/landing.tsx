import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(to bottom right, #0a001f, #21157d, #2d1b69)' }}>
      {/* Banner */}
      <div className="w-full h-64 md:h-80 lg:h-96 bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center overflow-hidden">
        <img
          src="https://pbs.twimg.com/profile_banners/1831526365163876352/1758084437/1500x500"
          alt="EigenTribe Banner"
          className="w-full h-full object-cover opacity-90"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 -mt-32 relative z-10">
        <div className="max-w-md w-full space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <img
              src="https://pbs.twimg.com/profile_images/1967450224168943616/Za_8hiTn_400x400.jpg"
              alt="EigenTribe Logo"
              className="w-32 h-32 rounded-full border-4 border-white shadow-2xl"
            />
          </div>

          {/* Title and Tagline */}
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold text-white" data-testid="text-game-title">
              Mismatched 
            </h1>
            <p className="text-lg" style={{ color: '#c4b5fd' }}>
              Match tiles, beat the clock, climb the leaderboard.
            </p>
          </div>

          {/* Login Button */}
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              className="text-lg px-12 py-6 rounded-full bg-white shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105"
              style={{ color: '#21157d' }}
              onClick={() => window.location.href = "/api/auth/google"}
              data-testid="button-login"
            >
              Sign in with Google
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-purple-500 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute bottom-1/4 right-10 w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ background: '#21157d' }}></div>
      </div>
    </div>
  );
}
