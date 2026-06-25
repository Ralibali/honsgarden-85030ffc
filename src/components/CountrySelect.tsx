import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COUNTRY_LIST, COUNTRIES, type CountryCode } from "@/lib/countries";
import { useTranslation } from "react-i18next";

interface CountrySelectProps {
  value: CountryCode;
  onChange: (code: CountryCode) => void;
  /** Hjälpsam label – sätts på fältet med ett synligt namn via aria. */
  ariaLabel?: string;
}

/**
 * Sökbar landsväljare med flagga och landsnamn på aktivt språk.
 * Mobiltillvänlig via Popover + Command.
 */
export function CountrySelect({ value, onChange, ariaLabel }: CountrySelectProps) {
  const { i18n, t } = useTranslation("auth");
  const [open, setOpen] = useState(false);
  const isSv = i18n.language?.startsWith("sv");
  const current = COUNTRIES[value];

  const items = useMemo(() => COUNTRY_LIST.map(c => ({
    code: c.code,
    label: isSv ? c.name_sv : c.name_en,
    flag: c.flag,
  })), [isSv]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? t("country")}
          className="w-full justify-between h-11"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true">{current?.flag}</span>
            <span>{isSv ? current?.name_sv : current?.name_en}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("search_country")} />
          <CommandList>
            <CommandEmpty>—</CommandEmpty>
            <CommandGroup>
              {items.map(item => (
                <CommandItem
                  key={item.code}
                  value={`${item.label} ${item.code}`}
                  onSelect={() => {
                    onChange(item.code as CountryCode);
                    setOpen(false);
                  }}
                >
                  <span className="mr-2" aria-hidden="true">{item.flag}</span>
                  <span>{item.label}</span>
                  <Check className={cn("ml-auto h-4 w-4", value === item.code ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
