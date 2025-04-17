import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import React, { createContext, useContext } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const SettingCollapsibleContext = createContext<boolean>(false);

export const useSettingCollapsible = () => useContext(SettingCollapsibleContext);

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

export const SettingSection: React.FC<SettingSectionProps> = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-medium">{title}</h2>
    <Card>
      <CardContent className="p-4 space-y-4 text-foreground text-sm">{children}</CardContent>
    </Card>
  </section>
);

interface SettingCollapsibleProps {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

export const SettingCollapsible: React.FC<SettingCollapsibleProps> = ({ icon, label, children }) => (
  <SettingCollapsibleContext.Provider value={true}>
    <Collapsible className="w-full ">
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 rounded-md hover:bg-muted/15">
        <div className="flex items-center space-x-2">
          {icon}
          <span>{label}</span>
        </div>
        <ChevronDown className="w-4 h-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">{children}</CollapsibleContent>
    </Collapsible>
  </SettingCollapsibleContext.Provider>
);

interface SettingItemProps {
  icon?: React.ReactNode;
  label: string;
  labelClassName?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export const SettingItem: React.FC<SettingItemProps> = ({ icon, label, labelClassName = "", htmlFor, children }) => {
  const insideCollapsible = useSettingCollapsible();
  return (
    <div className={`flex items-center justify-between py-0 ${!insideCollapsible ? "" : "pl-12"}`}>
      <div className="flex items-center space-x-2">
        {icon}
        <Label htmlFor={htmlFor} className={cn(labelClassName, insideCollapsible && "text-muted-foreground")}>
          {label}
        </Label>
      </div>
      {children}
    </div>
  );
};
