import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';

export function ActiveBookingsList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Bookings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <p className="font-medium">Fluffy - Grooming</p>
              <p className="text-sm text-gray-500">Today, 2:00 PM</p>
            </div>
            <Badge>Confirmed</Badge>
          </div>
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <p className="font-medium">Max - Training</p>
              <p className="text-sm text-gray-500">Today, 4:00 PM</p>
            </div>
            <Badge variant="outline">Pending</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
