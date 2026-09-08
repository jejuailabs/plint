import importlib.util
import math
import sys
import types
import unittest

sys.modules.setdefault("runpod", types.ModuleType("runpod"))
spec=importlib.util.spec_from_file_location("plint_worker","workers/blender/handler.py")
worker=importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class WorkerInputTests(unittest.TestCase):
    def payload(self):
        ring=[{"latitude":33.467,"longitude":126.338},{"latitude":33.467,"longitude":126.339},{"latitude":33.468,"longitude":126.339},{"latitude":33.467,"longitude":126.338}]
        return {"analysisId":"test","address":"애월해안로 255","parcel":{"areaSqm":904,"boundary":ring},"context":[],"scenario":{"floors":3,"buildingCoveragePercent":40,"floorAreaRatioPercent":100,"floorHeights":[4,3.3,3.3],"floorAreasSqm":[300,300,200],"placement":{"widthM":20,"depthM":15,"rotationRad":0.4,"center":ring[0]}}}
    def test_preserves_actual_boundary_and_floor_areas(self):
        p=self.payload();result=worker.validate_input(p)
        self.assertEqual(result["parcel"]["boundary"],p["parcel"]["boundary"])
        self.assertEqual(result["scenario"]["floorAreasSqm"],[300,300,200])
        self.assertEqual(result["context"],[])
    def test_rejects_missing_geometry_instead_of_fabricating(self):
        p=self.payload();del p["scenario"]["placement"]
        with self.assertRaises(ValueError):worker.validate_input(p)
    def test_rejects_mismatched_floor_geometry(self):
        p=self.payload();p["scenario"]["floorHeights"]=[4]
        with self.assertRaises(ValueError):worker.validate_input(p)
    def test_rejects_nonfinite_values(self):
        p=self.payload();p["parcel"]["areaSqm"]=math.nan
        with self.assertRaises(ValueError):worker.validate_input(p)

if __name__=="__main__":unittest.main()
