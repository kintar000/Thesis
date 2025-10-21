import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Pencil, Trash2, Eye, Upload, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { AccessoryStatus } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

const accessorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  category: z.string().min(1, "Category is required"),
  status: z.string().min(1, "Status is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.string().optional(),
  location: z.string().optional(),
  knoxId: z.string().optional(),
  notes: z.string().optional(),
  releasedBy: z.string().optional(),
  returnedTo: z.string().optional(),
  dateReleased: z.string().optional(),
  dateReturned: z.string().optional(),
});

type AccessoryFormValues = z.infer<typeof accessorySchema>;

type Accessory = {
  id: number;
  name: string;
  category: string;
  quantity: number; // Server returns this as a number
  serialNumber?: string; // Match schema.ts
  model?: string; // Match schema.ts
  manufacturer?: string;
  purchaseDate?: string;
  purchaseCost?: string;
  location?: string; // Match schema.ts
  notes?: string;
  assignedTo?: number; // Match schema.ts
  knoxId?: string; // Added KnoxID field
  status?: string;
  releasedBy?: string;
  returnedTo?: string;
  dateReleased?: string;
  dateReturned?: string;
};

export default function Accessories() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewAccessory, setViewAccessory] = useState<Accessory | null>(null);
  const [editAccessory, setEditAccessory] = useState<Accessory | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [accessoryToDelete, setAccessoryToDelete] = useState<Accessory | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const { toast } = useToast();

  const form = useForm<AccessoryFormValues>({
    resolver: zodResolver(accessorySchema),
    defaultValues: {
      name: "",
      category: "",
      status: "available",
      quantity: 1,
      manufacturer: "",
      model: "",
      serialNumber: "",
      purchaseDate: "",
      purchaseCost: "",
      location: "",
      knoxId: "",
      notes: "",
      releasedBy: "",
      returnedTo: "",
      dateReleased: "",
      dateReturned: "",
    },
  });

  // Fetch accessories
  const { data: accessories = [], isLoading } = useQuery({
    queryKey: ['/api/accessories'],
    queryFn: async () => {
      const res = await fetch('/api/accessories');
      if (!res.ok) {
        throw new Error('Failed to fetch accessories');
      }
      return res.json();
    }
  });

  // Filter accessories based on search query
  const filteredAccessories = accessories.filter(accessory => 
    accessory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    accessory.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (accessory.manufacturer && accessory.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Add accessory mutation
  const addAccessoryMutation = useMutation({
    mutationFn: async (data: AccessoryFormValues) => {
      return apiRequest('POST', '/api/accessories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accessories'] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Accessory added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add accessory",
        variant: "destructive",
      });
    },
  });

  // Edit accessory mutation
  const editAccessoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: AccessoryFormValues }) => {
      return apiRequest('PATCH', `/api/accessories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accessories'] });
      setIsEditDialogOpen(false);
      setEditAccessory(null);
      toast({
        title: "Success",
        description: "Accessory updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update accessory",
        variant: "destructive",
      });
    },
  });

  // Delete accessory mutation
  const deleteAccessoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/accessories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accessories'] });
      toast({
        title: "Success",
        description: "Accessory deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete accessory",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AccessoryFormValues) => {
    addAccessoryMutation.mutate(data);
  };

  const handleEditSubmit = (data: AccessoryFormValues) => {
    if (editAccessory) {
      editAccessoryMutation.mutate({ id: editAccessory.id, data });
    }
  };

  const handleDeleteClick = (accessory: Accessory) => {
      setAccessoryToDelete(accessory);
      setIsConfirmDeleteOpen(true);
  };

  const confirmDeleteAccessory = () => {
    if (accessoryToDelete) {
      deleteAccessoryMutation.mutate(accessoryToDelete.id, {
        onSuccess: () => {
          // Close the confirmation dialog
          setIsConfirmDeleteOpen(false);
          setAccessoryToDelete(null);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to delete accessory",
            variant: "destructive",
          });
        },
      });
    }
  };


  const handleEditClick = (accessory: Accessory) => {
    setEditAccessory(accessory);
    form.reset({
      name: accessory.name,
      category: accessory.category,
      status: accessory.status || "available",
      quantity: accessory.quantity,
      manufacturer: accessory.manufacturer || "",
      model: accessory.model || "",
      serialNumber: accessory.serialNumber || "",
      purchaseDate: accessory.purchaseDate || "",
      purchaseCost: accessory.purchaseCost || "",
      location: accessory.location || "",
      knoxId: accessory.knoxId || "",
      notes: accessory.notes || "",
      releasedBy: accessory.releasedBy || "",
      returnedTo: accessory.returnedTo || "",
      dateReleased: accessory.dateReleased || "",
      dateReturned: accessory.dateReturned || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleViewClick = (accessory: Accessory) => {
    setViewAccessory(accessory);
    setIsViewDialogOpen(true);
  };

  const accessoryCategories = [
    "Cable",
    "Charger",
    "Docking Station",
    "Headphones",
    "Keyboard",
    "Mouse",
    "Power Adapter",
    "Printer",
    "Scanner",
    "Webcam",
    "Other"
  ];

  const handleExportCSV = () => {
    if (!accessories || accessories.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no accessories to export.",
        variant: "destructive",
      });
      return;
    }

    const csvData = accessories.map(accessory => ({
      name: accessory.name,
      category: accessory.category || '',
      quantity: accessory.quantity || '',
      status: accessory.status || '',
      location: accessory.location || '',
      serialNumber: accessory.serialNumber || '',
      model: accessory.model || '',
      manufacturer: accessory.manufacturer || '',
      purchaseDate: accessory.purchaseDate || '',
      purchaseCost: accessory.purchaseCost || '',
      knoxId: accessory.knoxId || '',
      notes: accessory.notes || '',
      releasedBy: accessory.releasedBy || '',
      returnedTo: accessory.returnedTo || '',
      dateReleased: accessory.dateReleased || '',
      dateReturned: accessory.dateReturned || ''
    }));

    const csvContent = [
      "Name,Category,Quantity,Status,Location,Serial Number,Model,Manufacturer,Purchase Date,Purchase Cost,Knox ID,Notes,Released By,Returned To,Date Released,Date Returned",
      ...csvData.map(accessory => 
        `"${accessory.name}","${accessory.category}","${accessory.quantity}","${accessory.status}","${accessory.location}","${accessory.serialNumber}","${accessory.model}","${accessory.manufacturer}","${accessory.purchaseDate}","${accessory.purchaseCost}","${accessory.knoxId}","${accessory.notes}","${accessory.releasedBy}","${accessory.returnedTo}","${accessory.dateReleased}","${accessory.dateReturned}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessories-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Accessories data has been exported to CSV.",
    });
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));

        const importedAccessories = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',').map(v => v.replace(/"/g, ''));

          const accessory = {
            name: values[0] || '',
            category: values[1] || '',
            quantity: values[2] || '',
            status: values[3] || 'available',
            location: values[4] || '',
            serialNumber: values[5] || '',
            model: values[6] || '',
            manufacturer: values[7] || '',
            purchaseDate: values[8] || '',
            purchaseCost: values[9] || '',
            knoxId: values[10] || '',
            notes: values[11] || '',
            releasedBy: values[12] || '',
            returnedTo: values[13] || '',
            dateReleased: values[14] || '',
            dateReturned: values[15] || ''
          };

          if (accessory.name) {
            importedAccessories.push(accessory);
          }
        }

        // Here you would typically make API calls to create each accessory
        // For now, we'll just show a success message
        setIsImportDialogOpen(false);

        toast({
          title: "Import successful",
          description: `Ready to import ${importedAccessories.length} accessories. Please implement API integration.`,
        });
      } catch (error) {
        toast({
          title: "Import failed",
          description: "Failed to import CSV file. Please check the format.",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accessories</h1>
          <p className="text-muted-foreground">
            Manage your accessories inventory
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsImportDialogOpen(true)}
            className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-300"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-300"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Accessory
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search accessories..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accessories Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-24 text-center text-muted-foreground">
              Loading...
            </div>
          ) : accessories.length === 0 ? (
            <div className="py-24 text-center text-muted-foreground">
              No accessories found. Add one to get started.
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccessories.map((accessory) => (
                    <TableRow key={accessory.id}>
                      <TableCell className="font-medium">{accessory.name}</TableCell>
                      <TableCell>{accessory.category}</TableCell>
                      <TableCell>{accessory.quantity}</TableCell>
                      <TableCell>
                        {accessory.status && (
                          <Badge
                            variant={
                              accessory.status === AccessoryStatus.AVAILABLE ? "outline" :
                              accessory.status === AccessoryStatus.BORROWED ? "secondary" :
                              accessory.status === AccessoryStatus.RETURNED ? "default" :
                              "destructive"
                            }
                          >
                            {accessory.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{accessory.location || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewClick(accessory)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(accessory)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(accessory)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Accessory Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[95%] max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Accessory Details</DialogTitle>
          </DialogHeader>

          {viewAccessory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Name</Label>
                  <p className="font-medium">{viewAccessory.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Category</Label>
                  <p className="font-medium">{viewAccessory.category}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge
                      variant={
                        viewAccessory.status === AccessoryStatus.AVAILABLE ? "outline" :
                        viewAccessory.status === AccessoryStatus.BORROWED ? "secondary" :
                        viewAccessory.status === AccessoryStatus.RETURNED ? "default" :
                        "destructive"
                      }
                    >
                      {viewAccessory.status || "Unknown"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Quantity</Label>
                  <p className="font-medium">{viewAccessory.quantity}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Serial Number</Label>
                  <p className="font-medium">{viewAccessory.serialNumber || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Model</Label>
                  <p className="font-medium">{viewAccessory.model || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Manufacturer</Label>
                  <p className="font-medium">{viewAccessory.manufacturer || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Location</Label>
                  <p className="font-medium">{viewAccessory.location || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Purchase Date</Label>
                  <p className="font-medium">{viewAccessory.purchaseDate || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Purchase Cost</Label>
                  <p className="font-medium">{viewAccessory.purchaseCost || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Knox ID</Label>
                  <p className="font-medium">{viewAccessory.knoxId || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Assigned To</Label>
                  <p className="font-medium">{viewAccessory.assignedTo || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Released By</Label>
                  <p className="font-medium">{viewAccessory.releasedBy || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Date Released</Label>
                  <p className="font-medium">{viewAccessory.dateReleased || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Returned To</Label>
                  <p className="font-medium">{viewAccessory.returnedTo || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Date Returned</Label>
                  <p className="font-medium">{viewAccessory.dateReturned || "-"}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Notes</Label>
                <p className="font-medium whitespace-pre-wrap">{viewAccessory.notes || "-"}</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
                <Button onClick={() => {
                  setIsViewDialogOpen(false);
                  handleEditClick(viewAccessory);
                }}>
                  Edit
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Accessory Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-[95%] max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Accessory</DialogTitle>
            <DialogDescription>
              Add a new accessory to your inventory
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Logitech Mouse" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accessoryCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={AccessoryStatus.AVAILABLE}>Available</SelectItem>
                          <SelectItem value={AccessoryStatus.BORROWED}>Borrowed</SelectItem>
                          <SelectItem value={AccessoryStatus.RETURNED}>Returned</SelectItem>
                          <SelectItem value={AccessoryStatus.DEFECTIVE}>Defective</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity*</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input placeholder="SN12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="MX Master 3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="manufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manufacturer</FormLabel>
                      <FormControl>
                        <Input placeholder="Logitech" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Storage Room A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchaseCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Cost</FormLabel>
                      <FormControl>
                        <Input placeholder="99.99" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="knoxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Knox ID</FormLabel>
                      <FormControl>
                        <Input placeholder="NP750-12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="releasedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Released By</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Name of person who released the accessory" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateReleased"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Released</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          placeholder="YYYY-MM-DD" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="returnedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Returned To</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Name of person receiving the return" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateReturned"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Returned</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          placeholder="YYYY-MM-DD" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional information about this accessory"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addAccessoryMutation.isPending}>
                  {addAccessoryMutation.isPending ? "Adding..." : "Add Accessory"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Accessory Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95%] max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Accessory</DialogTitle>
            <DialogDescription>
              Update the details of this accessory
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name*</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accessoryCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={AccessoryStatus.AVAILABLE}>Available</SelectItem>
                          <SelectItem value={AccessoryStatus.BORROWED}>Borrowed</SelectItem>
                          <SelectItem value={AccessoryStatus.RETURNED}>Returned</SelectItem>
                          <SelectItem value={AccessoryStatus.DEFECTIVE}>Defective</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity*</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="manufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manufacturer</FormLabel>
                      <FormControl><Input {...field} />
                                            </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchaseCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Cost</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="knoxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Knox ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="releasedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Released By</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Name of person who released the accessory" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateReleased"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Released</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          placeholder="YYYY-MM-DD" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="returnedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Returned To</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Name of person receiving the return" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateReturned"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Returned</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          placeholder="YYYY-MM-DD" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editAccessoryMutation.isPending}>
                  {editAccessoryMutation.isPending ? "Updating..." : "Update Accessory"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="w-[95%] max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Import Accessories from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple accessories at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="csvFile">Select CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="mt-2"
              />
            </div>
            <div className="text-sm text-gray-600">
              <p>CSV format should include columns:</p>
              <p className="font-mono text-xs mt-1">
                Name,Category,Quantity,Status,Location,Serial Number,Model,Manufacturer,Purchase Date,Purchase Cost,Knox ID,Notes,Released By,Returned To,Date Released,Date Returned
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirmationDialog
        open={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDeleteAccessory}
        itemType="accessory"
        itemName={accessoryToDelete?.name || "this accessory"}
        isLoading={deleteAccessoryMutation.isPending}
      />
    </div>
  );
}