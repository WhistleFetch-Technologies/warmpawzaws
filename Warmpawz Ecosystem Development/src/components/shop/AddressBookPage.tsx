import React, { useState } from 'react';
import { MapPin, Plus, Edit2, Trash2, MoreVertical, Home, Briefcase } from 'lucide-react';
import { CustomerProfileLayout } from './CustomerProfileLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "../ui/dialog";
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

// Mock Data
const INITIAL_ADDRESSES = [
  { 
    id: '1', 
    name: 'Rahul Sharma', 
    type: 'Home', 
    line: 'Flat 402, Sunshine Apartments, Indiranagar', 
    city: 'Bangalore', 
    pin: '560038', 
    phone: '9876543210', 
    state: 'Karnataka',
    isDefault: true
  },
  { 
    id: '2', 
    name: 'Rahul Work', 
    type: 'Work', 
    line: 'Tech Park, EGL, Domlur', 
    city: 'Bangalore', 
    pin: '560071', 
    phone: '9876543210', 
    state: 'Karnataka',
    isDefault: false
  }
];

interface AddressBookPageProps {
  onNavigate: (path: string) => void;
}

export function AddressBookPage({ onNavigate }: AddressBookPageProps) {
  const [addresses, setAddresses] = useState(INITIAL_ADDRESSES);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pincode: '',
    line: '',
    city: '',
    state: '',
    type: 'Home'
  });

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({ name: '', phone: '', pincode: '', line: '', city: '', state: '', type: 'Home' });
    setIsDialogOpen(true);
  };

  const handleEdit = (addr: any) => {
    setEditingId(addr.id);
    setFormData({ ...addr });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this address?')) {
        setAddresses(addresses.filter(a => a.id !== id));
    }
  };

  const handleSave = () => {
    if (editingId) {
        setAddresses(addresses.map(a => a.id === editingId ? { ...formData, id: editingId, isDefault: a.isDefault } : a));
    } else {
        const newId = Math.random().toString(36).substr(2, 9);
        setAddresses([...addresses, { ...formData, id: newId, isDefault: addresses.length === 0 }]);
    }
    setIsDialogOpen(false);
  };

  const makeDefault = (id: string) => {
    setAddresses(addresses.map(a => ({ ...a, isDefault: a.id === id })));
  };

  return (
    <CustomerProfileLayout currentPath="account/addresses" onNavigate={onNavigate}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-xl font-semibold">Address Book</h2>
           <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" /> Add New Address
           </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {addresses.map((addr) => (
              <Card key={addr.id} className={`relative ${addr.isDefault ? 'border-primary bg-blue-50/10' : ''}`}>
                  {addr.isDefault && (
                      <div className="absolute top-0 right-0 bg-primary text-white text-[10px] px-2 py-1 rounded-bl-lg rounded-tr-sm font-medium">
                          DEFAULT
                      </div>
                  )}
                  <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                             <Badge variant="outline" className="flex items-center gap-1 bg-white">
                                {addr.type === 'Home' ? <Home className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                                {addr.type}
                             </Badge>
                          </div>
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(addr)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                  {!addr.isDefault && <DropdownMenuItem onClick={() => makeDefault(addr.id)}><MapPin className="mr-2 h-4 w-4" /> Make Default</DropdownMenuItem>}
                                  <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(addr.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </div>
                      <CardTitle className="text-base font-bold mt-2">{addr.name}</CardTitle>
                      <CardDescription>{addr.phone}</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                          {addr.line}<br />
                          {addr.city}, {addr.state} - <span className="font-semibold text-foreground">{addr.pin}</span>
                      </p>
                  </CardContent>
              </Card>
           ))}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{editingId ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                    <DialogDescription>Make sure your delivery details are accurate.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Rahul Sharma" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="10-digit number" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="line">Address Line</Label>
                        <Input id="line" value={formData.line} onChange={(e) => setFormData({...formData, line: e.target.value})} placeholder="House No, Street, Area" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} placeholder="City" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pin">Pincode</Label>
                            <Input id="pin" value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} placeholder="Pincode" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Address Type</Label>
                        <RadioGroup defaultValue={formData.type} onValueChange={(v) => setFormData({...formData, type: v})} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Home" id="r1" />
                                <Label htmlFor="r1">Home</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Work" id="r2" />
                                <Label htmlFor="r2">Work</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSave}>Save Address</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </CustomerProfileLayout>
  );
}
