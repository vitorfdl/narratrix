import { motion } from "framer-motion";
import { Construction } from "lucide-react";

export default function LorebooksPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <motion.div
        animate={{
          rotate: [0, 5, -5, 5, 0],
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 5,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "reverse",
        }}
        className="relative mb-8"
      >
        <Construction className="h-32 w-32 text-primary/70" strokeWidth={1} />
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/5"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{
            duration: 4,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            delay: 0.5,
          }}
        />
      </motion.div>

      <h2 className="text-2xl font-semibold mb-3">Lorebooks Feature Coming Soon!</h2>
      <p className="text-muted-foreground max-w-md">
        We are currently building the Lorebooks feature to enhance your world-building experience. Stay tuned for updates!
      </p>
    </div>
  );
}
