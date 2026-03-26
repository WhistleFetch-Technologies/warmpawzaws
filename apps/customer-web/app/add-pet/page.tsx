import { redirect } from 'next/navigation';

/** Deep link from payment / flows: open My Pets with add sheet. */
export default function AddPetPage() {
  redirect('/pets?openAdd=1');
}
