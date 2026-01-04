import { redirect } from 'next/navigation'

// Redirect to admin panel verification page
export default function ReportsListingPage() {
    redirect('/admin/verification')
}
