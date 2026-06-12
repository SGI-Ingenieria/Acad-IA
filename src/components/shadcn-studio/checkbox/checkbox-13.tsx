import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const CheckboxCardDemo = () => {
  return (
    <div className="space-y-2">
      <Label className="border-border hover:border-primary/30 hover:bg-accent/50 flex cursor-pointer items-center items-start gap-2 gap-3 rounded-lg border p-3 transition-colors has-aria-checked:border-blue-600 has-aria-checked:bg-blue-50 dark:has-aria-checked:border-blue-900 dark:has-aria-checked:bg-blue-950">
        <Checkbox
          defaultChecked
          className="peer border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:ring-ring h-5 w-5 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="grid gap-1.5 font-normal">
          <p className="text-sm leading-none font-medium">Auto Start</p>
          <p className="text-muted-foreground text-sm">
            Starting with your OS.
          </p>
        </div>
      </Label>
      <Label className="hover:bg-accent/50 flex items-start gap-2 rounded-lg border p-3 has-aria-checked:border-blue-600 has-aria-checked:bg-blue-50 dark:has-aria-checked:border-blue-900 dark:has-aria-checked:bg-blue-950">
        <Checkbox className="peer border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:ring-ring h-5 w-5 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50" />
        <div className="grid gap-1.5 font-normal">
          <p className="text-sm leading-none font-medium">Auto update</p>
          <p className="text-muted-foreground text-sm">
            Download and install new version
          </p>
        </div>
      </Label>
    </div>
  )
}

export default CheckboxCardDemo
