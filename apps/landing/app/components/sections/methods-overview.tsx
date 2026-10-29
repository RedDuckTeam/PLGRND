import Link from 'next/link'
import { METHODS } from '@/app/lib/methods'

export function MethodsOverview() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Method
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              When to choose
            </th>
          </tr>
        </thead>
        <tbody>
          {METHODS.map((method) => (
            <tr key={method.slug} className="border-t border-border align-top">
              <th scope="row" className="w-2/5 px-4 py-4 font-normal">
                <Link
                  href={method.href}
                  className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
                >
                  {method.title}
                </Link>
                <span className="mt-1 block text-muted-foreground">{method.summary}</span>
              </th>
              <td data-when-to-choose={method.slug} className="px-4 py-4 leading-6">
                {method.whenToChoose}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
