'use client'

interface DashboardGreetingProps {
  displayName: string
}

export default function DashboardGreeting({ displayName }: DashboardGreetingProps) {
  const now = new Date()
  const hour = now.getHours()

  let greeting: string
  if (hour < 12) {
    greeting = 'Good morning'
  } else if (hour < 17) {
    greeting = 'Good afternoon'
  } else {
    greeting = 'Good evening'
  }

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900">
        {greeting}, {displayName}! 👋
      </h1>
      <p className="text-gray-500 mt-1">{dateStr}</p>
    </div>
  )
}
