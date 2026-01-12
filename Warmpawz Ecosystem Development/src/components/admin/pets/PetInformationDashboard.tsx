import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

export function PetInformationDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Pet Information Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Pets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">1,234</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">56</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Breeds</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">42</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
