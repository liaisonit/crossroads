
"use client";
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className,
  actionOptions,
  portalContainer,
  creatable = false,
}: {
  options: Option[];
  value?: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  actionOptions?: Option[];
  portalContainer?: HTMLElement | null;
  creatable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setSearchTerm("");
    }
  }, [open]);

  const selected = options.find((o) => o.value.toLowerCase() === value?.toLowerCase());

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue === value ? "" : currentValue);
    setOpen(false);
  };
  
  const handleCreate = () => {
    if (creatable && searchTerm && !options.some(o => o.label.toLowerCase() === searchTerm.toLowerCase())) {
      onValueChange(searchTerm);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">
            {selected ? selected.label : (value || placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        container={portalContainer}
      >
        <Command onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>
              {creatable ? `Press Enter to add "${searchTerm}"` : "No results."}
            </CommandEmpty>
            <div className="max-h-60 overflow-y-auto overscroll-contain pr-1">
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              
              {creatable && searchTerm && !options.some(o => o.label.toLowerCase() === searchTerm.toLowerCase()) && (
                <CommandItem
                  key={searchTerm}
                  value={searchTerm}
                  onSelect={handleCreate}
                >
                  <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                  Add "{searchTerm}"
                </CommandItem>
              )}

              {actionOptions && actionOptions.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    {actionOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => {
                          onValueChange(option.value);
                          setOpen(false);
                        }}
                      >
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
