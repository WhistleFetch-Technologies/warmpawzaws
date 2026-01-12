import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

interface CustomerDashboardProps {
  session: any;
  journeyStage: any;
}

export function CustomerDashboard({ session, journeyStage }: CustomerDashboardProps) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome Back, {session?.user?.email || 'Customer'}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Pets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">No pets added yet.</p>
            <Button className="mt-4">Add Pet</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">No upcoming bookings.</p>
            <Button variant="outline" className="mt-4">Book Service</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
