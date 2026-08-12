import { BookIcon, GiftIcon, HeartIcon } from 'lucide-react'

import CheckboxCardDemo from '../checkbox/checkbox-13'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const tabs = [
  {
    name: 'Explore',
    value: 'explore',
    icon: BookIcon,
    content: (
      <>
        <CheckboxCardDemo />
      </>
    ),
  },
  {
    name: 'Favorites',
    value: 'favorites',
    icon: HeartIcon,
    content: (
      <>
        All your{' '}
        <span className="text-foreground font-semibold">favorites</span> are
        saved here. Revisit articles, collections, and moments you love, any
        time you want a little inspiration.
      </>
    ),
  },
  {
    name: 'Surprise',
    value: 'surprise',
    icon: GiftIcon,
    content: (
      <>
        <span className="text-foreground font-semibold">Surprise!</span>{' '}
        Here&apos;s something unexpected—a fun fact, a quirky tip, or a daily
        challenge. Come back for a new surprise every day!
      </>
    ),
  },
]

const TabsWithIconDemo = () => {
  return (
    <div className="w-full">
      <Tabs defaultValue="explore" className="gap-grupo">
        <TabsList className="w-full">
          {tabs.map(({ icon: Icon, name, value }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="gap-micro px-control sm:px-control flex items-center"
            >
              <Icon />
              {name}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="animate-in fade-in duration-300 ease-out"
          >
            <p className="text-muted-foreground text-sm">{tab.content}</p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default TabsWithIconDemo
