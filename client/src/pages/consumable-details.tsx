import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftIcon, EditIcon, TrashIcon, UserPlusIcon, PackageIcon, AlertCircleIcon, UploadIcon, SearchIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import ConsumableForm from "@/components/consumables/consumable-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseConsumableAssignmentsCSV } from "@/lib/csv-import";

export default function ConsumableDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isEditAssignmentDialogOpen, setIsEditAssignmentDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [assignData, setAssignData] = useState({
    assignedTo: "",
    serialNumber: "",
    knoxId: "",
    notes: ""
  });
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState("");
  const fileInputRef = useState<HTMLInputElement | null>(null);

  // Fetch consumable details with better error handling
  const { data: consumable, isLoading, error } = useQuery({
    queryKey: [`/api/consumables/${id}`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/consumables/${id}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      } catch (error) {
        console.error('Failed to fetch consumable:', error);
        throw error;
      }
    },
    enabled: !!id,
    retry: 3,
    retryDelay: 1000,
  });

  // Fetch consumable assignments with fallback
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: [`/api/consumables/${id}/assignments`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/consumables/${id}/assignments`);
        if (!response.ok) {
          console.warn('Failed to fetch assignments, using empty array');
          return [];
        }
        return response.json();
      } catch (error) {
        console.warn('Assignment fetch error:', error);
        return [];
      }
    },
    enabled: !!id,
    retry: 1,
  });

  // Update consumable mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/consumables/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update consumable: ${errorData}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/consumables/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/consumables'] });
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Consumable has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update consumable",
        variant: "destructive",
      });
    }
  });

  // Assign consumable mutation
  const assignMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/consumables/${id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          quantity: 1, // Default quantity to 1 for individual assignments
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Handle specific database connection errors
        if (responseData.code === 'DB_CONNECTION_FAILED') {
          throw new Error(`Database Error: ${responseData.error}\n\nInstructions: ${responseData.instruction}`);
        }
        throw new Error(responseData.message || responseData.error || 'Failed to assign consumable');
      }

      return responseData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/consumables/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/consumables/${id}/assignments`] });
      queryClient.invalidateQueries({ queryKey: ['/api/consumables'] });
      setIsAssignDialogOpen(false);
      setAssignData({ assignedTo: "", serialNumber: "", knoxId: "", notes: "" });
      toast({
        title: "Success",
        description: "Consumable has been assigned successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message;
      const isDbError = errorMessage.includes('Database Error:');

      console.error('Assignment error:', error);
      toast({
        title: isDbError ? "Database Connection Failed" : "Assignment Failed",
        description: errorMessage,
        variant: "destructive",
        duration: isDbError ? 10000 : 5000,
      });
    }
  });

  // Edit assignment mutation
  const editAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/consumables/${id}/assignments/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update assignment: ${errorData}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/consumables/${id}/assignments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/consumables/${id}`] }); // Also invalidate consumable query if needed
      setIsEditAssignmentDialogOpen(false);
      setAssignData({ assignedTo: "", serialNumber: "", knoxId: "", notes: "" });
      toast({
        title: "Success",
        description: "Assignment has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Edit assignment error:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update assignment",
        variant: "destructive",
      });
    }
  });


  // CSV Import handler
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvContent = event.target?.result as string;
        const assignments = parseConsumableAssignmentsCSV(csvContent);

        // Filter assignments for this consumable
        const relevantAssignments = assignments.filter(
          a => a.consumableId === id
        );

        if (relevantAssignments.length === 0) {
          toast({
            title: "No assignments found",
            description: `No assignments found for consumable ID ${id} in the CSV file.`,
            variant: "destructive",
          });
          return;
        }

        // Import each assignment
        for (const assignment of relevantAssignments) {
          await assignMutation.mutateAsync({
            assignedTo: assignment.assignedTo,
            serialNumber: assignment.serialNumber || "",
            knoxId: assignment.knoxId || "",
            quantity: parseInt(assignment.quantity || "1"),
            notes: assignment.notes || ""
          });
        }

        setIsImportDialogOpen(false);
        toast({
          title: "Import successful",
          description: `Imported ${relevantAssignments.length} assignment(s).`,
        });
      } catch (error) {
        toast({
          title: "Import failed",
          description: error.message,
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  // Delete consumable mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/consumables/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to delete consumable: ${errorData}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consumables'] });
      setLocation('/consumables');
      toast({
        title: "Success",
        description: "Consumable has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete consumable",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent absolute top-0 left-0"></div>
        </div>
        <div className="ml-4 text-slate-600">Loading consumable details...</div>
      </div>
    );
  }

  if (error || !consumable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Alert className="border-red-200 bg-red-50 mb-6">
            <AlertCircleIcon className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error ? 'Failed to load consumable details' : 'Consumable not found'}
            </AlertDescription>
          </Alert>
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold mb-2">Consumable Not Available</h2>
            <p className="text-gray-500 mb-4">The requested consumable could not be loaded.</p>
            <Button onClick={() => setLocation('/consumables')}>
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Back to Consumables
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const availableQuantity = Math.max(0, (consumable.quantity || 0) - assignments.length);

  // Filter assignments based on search query
  const filteredAssignments = assignments.filter(assignment => {
    if (!assignmentSearchQuery) return true;

    const searchLower = assignmentSearchQuery.toLowerCase();
    return (
      assignment.assignedTo?.toLowerCase().includes(searchLower) ||
      assignment.serialNumber?.toLowerCase().includes(searchLower) ||
      assignment.knoxId?.toLowerCase().includes(searchLower) ||
      assignment.notes?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="space-y-8 p-6 animate-in fade-in-0 duration-700">
        <div className="flex items-center justify-between animate-in slide-in-from-top-5 duration-700">
          <div className="flex items-center gap-6">
            <Button
              variant="outline"
              onClick={() => setLocation('/consumables')}
              className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all duration-300 transform hover:scale-105"
            >
              <ArrowLeftIcon className="mr-2 h-5 w-5" />
              Back to Consumables
            </Button>
            <div className="space-y-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {consumable.name}
              </h1>
              <p className="text-lg text-slate-600 font-medium">Consumable Details</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <EditIcon className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Consumable</DialogTitle>
                  <DialogDescription>Update consumable information</DialogDescription>
                </DialogHeader>
                <ConsumableForm
                  defaultValues={consumable}
                  onSubmit={(data) => updateMutation.mutate(data)}
                  isLoading={updateMutation.isPending}
                />
              </DialogContent>
            </Dialog>

            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="assignments">
              Assignments ({assignments.length})
              {assignmentsLoading && " (Loading...)"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageIcon className="h-5 w-5" />
                  Consumable Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Name</Label>
                    <p className="mt-1 text-sm">{consumable.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Type/Category</Label>
                    <p className="mt-1 text-sm">{consumable.category}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <div className="mt-1">
                      <Badge className={consumable.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                        {consumable.status === 'available' ? 'Available' : 'In Use'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Model</Label>
                    <p className="mt-1 text-sm">{consumable.modelNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Total Quantity</Label>
                    <p className="mt-1 text-sm font-medium text-lg">{consumable.quantity || 0}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Available</Label>
                    <p className="mt-1 text-sm font-medium text-lg text-green-600">{availableQuantity}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Location</Label>
                    <p className="mt-1 text-sm">{consumable.location || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Manufacturer</Label>
                    <p className="mt-1 text-sm">{consumable.manufacturer || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Purchase Date</Label>
                    <p className="mt-1 text-sm">{formatDate(consumable.purchaseDate)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Purchase Cost</Label>
                    <p className="mt-1 text-sm">{consumable.purchaseCost ? `$${consumable.purchaseCost}` : 'N/A'}</p>
                  </div>
                </div>

                {consumable.notes && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Notes</Label>
                    <p className="mt-1 text-sm bg-gray-50 p-3 rounded-md">{consumable.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments">
            <Card>
              <CardHeader className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Consumable Assignments</CardTitle>
                  <div className="flex gap-2">
                  <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <UploadIcon className="mr-2 h-4 w-4" />
                        Import CSV
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Assignments from CSV</DialogTitle>
                        <DialogDescription>
                          Upload a CSV file with columns: consumableId, assignedTo, serialNumber (optional), knoxId (optional), quantity (optional), notes (optional)
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={handleCSVImport}
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={availableQuantity <= 0}>
                      <UserPlusIcon className="mr-2 h-4 w-4" />
                      Assign Consumable
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Consumable</DialogTitle>
                      <DialogDescription>Assign this consumable to someone</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div>
                        <Label htmlFor="assignedTo">Assigned To *</Label>
                        <Input
                          id="assignedTo"
                          value={assignData.assignedTo}
                          onChange={(e) => setAssignData({...assignData, assignedTo: e.target.value})}
                          placeholder="Enter person or department name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="serialNumber">Serial Number</Label>
                        <Input
                          id="serialNumber"
                          value={assignData.serialNumber}
                          onChange={(e) => setAssignData({...assignData, serialNumber: e.target.value})}
                          placeholder="Enter serial number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="knoxId">Knox ID</Label>
                        <Input
                          id="knoxId"
                          value={assignData.knoxId}
                          onChange={(e) => setAssignData({...assignData, knoxId: e.target.value})}
                          placeholder="Enter Knox ID"
                        />
                      </div>
                      <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={assignData.notes}
                          onChange={(e) => setAssignData({...assignData, notes: e.target.value})}
                          placeholder="Additional notes about this assignment"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => assignMutation.mutate(assignData)}
                        disabled={!assignData.assignedTo.trim() || assignMutation.isPending}
                      >
                        {assignMutation.isPending ? "Assigning..." : "Assign"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Edit Assignment Dialog */}
                <Dialog open={isEditAssignmentDialogOpen} onOpenChange={setIsEditAssignmentDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Assignment</DialogTitle>
                      <DialogDescription>Update assignment details for this consumable</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div>
                        <Label htmlFor="edit-assignedTo">Assigned To *</Label>
                        <Input
                          id="edit-assignedTo"
                          value={assignData.assignedTo}
                          onChange={(e) => setAssignData({...assignData, assignedTo: e.target.value})}
                          placeholder="Enter person or department name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-serialNumber">Serial Number</Label>
                        <Input
                          id="edit-serialNumber"
                          value={assignData.serialNumber}
                          onChange={(e) => setAssignData({...assignData, serialNumber: e.target.value})}
                          placeholder="Enter serial number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-knoxId">Knox ID</Label>
                        <Input
                          id="edit-knoxId"
                          value={assignData.knoxId}
                          onChange={(e) => setAssignData({...assignData, knoxId: e.target.value})}
                          placeholder="Enter Knox ID"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-notes">Notes</Label>
                        <Textarea
                          id="edit-notes"
                          value={assignData.notes}
                          onChange={(e) => setAssignData({...assignData, notes: e.target.value})}
                          placeholder="Additional notes about this assignment"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsEditAssignmentDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => editAssignmentMutation.mutate(assignData)}
                        disabled={!assignData.assignedTo.trim() || editAssignmentMutation.isPending}
                      >
                        {editAssignmentMutation.isPending ? "Updating..." : "Update Assignment"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                  </div>
                </div>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search assignments by assignee, serial number, Knox ID, or notes..."
                    value={assignmentSearchQuery}
                    onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading assignments...</p>
                  </div>
                ) : filteredAssignments.length > 0 ? (
                  <div className="space-y-4">
                    {filteredAssignments.map((assignment: any, index: number) => (
                      <div key={assignment.id || index} className="border rounded-lg p-4 relative">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Assigned To</Label>
                            <p className="font-medium">{assignment.assignedTo}</p>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Serial Number</Label>
                            <p>{assignment.serialNumber || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Knox ID</Label>
                            <p>{assignment.knoxId || 'N/A'}</p>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Assigned Date</Label>
                            <p>{formatDate(assignment.assignedDate)}</p>
                          </div>
                          {assignment.notes && (
                            <div className="md:col-span-4">
                              <Label className="text-xs font-medium text-gray-500">Notes</Label>
                              <p className="text-sm bg-gray-50 p-2 rounded">{assignment.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="absolute top-2 right-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAssignData({
                                id: assignment.id,
                                assignedTo: assignment.assignedTo,
                                serialNumber: assignment.serialNumber,
                                knoxId: assignment.knoxId,
                                notes: assignment.notes,
                              });
                              setIsEditAssignmentDialogOpen(true);
                            }}
                          >
                            <EditIcon className="h-4 w-4 text-gray-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : assignmentSearchQuery ? (
                  <div className="text-center py-8 text-gray-500">
                    <SearchIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No assignments found matching "{assignmentSearchQuery}"</p>
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={() => setAssignmentSearchQuery('')}
                    >
                      Clear Search
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No assignments yet. Click "Assign Consumable" to create one.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}