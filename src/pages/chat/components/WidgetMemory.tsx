import { motion } from "framer-motion";
import { Brain, Clock, Construction } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../components/ui/card";

const WidgetMemory = () => {
  return (
    <Card className="w-full border border-border bg-transparent border-none backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Construction className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">Memory Widget</CardTitle>
        </div>
        <CardDescription>This feature is currently under development</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          <motion.div
            animate={{
              rotate: [0, 10, -10, 10, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 4,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "reverse",
            }}
            className="relative"
          >
            <Brain className="h-24 w-24 text-primary/80" strokeWidth={1.5} />
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/10"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "reverse",
              }}
            />
          </motion.div>

          <div className="text-center space-y-2 max-w-md">
            <h3 className="text-lg font-medium">Memory Management Coming Soon</h3>
            <p className="text-muted-foreground text-sm">
              We're working on an intelligent memory system that will help your AI assistant remember important details from your conversations.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t border-border/50 pt-4">
        <div className="flex items-center text-xs text-muted-foreground">
          <Clock className="mr-1 h-3 w-3" />
          <span>Coming in the next update</span>
        </div>
        <Button variant="outline" size="sm">
          <Construction className="mr-2 h-4 w-4" />
          Stay Tuned
        </Button>
      </CardFooter>
    </Card>
  );
};

export default WidgetMemory;
